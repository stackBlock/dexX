const { expectRevert } = require("@openzeppelin/test-helpers");
const { inTransaction } = require("@openzeppelin/test-helpers/src/expectEvent");
const { assertion } = require("@openzeppelin/test-helpers/src/expectRevert");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");

// importing coin contracts
const Dai = artifacts.require("mocks/Dai.sol");
const Bat = artifacts.require("mocks/Bat.sol");
const Rep = artifacts.require("mocks/Rep.sol");
const Zrx = artifacts.require("mocks/Zrx.sol");
const Dex = artifacts.require("Dex.sol");

// variable to make code more readable instead
// of just 1 and 2 for buyTokens and sell
const cType = {
  buyTokens: 0,
  sellTokens: 1,
};

contract("Dex", (accounts) => {
  let dai, bat, rep, zrx, dex;

  // creating the traders acct 1 and acct 2
  // acct 0 is left for admin

  const trader1 = accounts[1];
  const trader2 = accounts[2];

  // creating tickers

  const DAI = web3.utils.fromAscii("DAI");
  const BAT = web3.utils.fromAscii("BAT");
  const REP = web3.utils.fromAscii("REP");
  const ZRX = web3.utils.fromAscii("ZRX");

  beforeEach(async () => {
    dai = await Dai.new();
    bat = await Bat.new();
    rep = await Rep.new();
    zrx = await Zrx.new();
    dex = await Dex.new();

    await dex.addToken(DAI, dai.address);
    await dex.addToken(BAT, bat.address);
    await dex.addToken(REP, rep.address);
    await dex.addToken(ZRX, zrx.address);

    // giving each trader 1000 of each token
    const amount = web3.utils.toWei("1000");
    const seedTokenBalance = async (token, trader) => {
      await token.faucet(trader, amount);
      await token.approve(dex.address, amount, { from: trader });
    };

    await seedTokenBalance(dai, trader1);
    await seedTokenBalance(bat, trader1);
    await seedTokenBalance(rep, trader1);
    await seedTokenBalance(zrx, trader1);

    await seedTokenBalance(dai, trader2);
    await seedTokenBalance(bat, trader2);
    await seedTokenBalance(rep, trader2);
    await seedTokenBalance(zrx, trader2);
  });

  it("should deposit tokens", async () => {
    await dex.deposit(
      // depositing 100 into DAI from trader 1
      web3.utils.toWei("100"),
      DAI,
      { from: trader1 }
    );

    // checking that the balance was correctly
    // deposited into dex contract.
    const balance = await dex.traderBalances(trader1, DAI);
    assert(balance.toString() === web3.utils.toWei('100'));
  });

  it("should not deposit unknown token", async () => {
    await expectRevert(
      dex.deposit(
        // using revert to check for the error message
        web3.utils.toWei("100"),
        web3.utils.fromAscii("NON TOKEN"),
        { from: trader1 }
      ),
      "this token does not exist"
    );
  });

  it("should withdraw tokens", async () => {
    await dex.deposit(
      // trader 1 deposit 100 DAI to dex contract
      web3.utils.toWei("100"),
      DAI,
      { from: trader1 }
    );

    await dex.withdraw(
      // trader 1 withdrew 100 form contract
      web3.utils.toWei("100"),
      DAI,
      { from: trader1 }
    );

    const [balanceDex, balanceDai] = await Promise.all([
      dex.traderBalances(trader1, DAI),
      dai.balanceOf(trader1),
    ]);
    assert(balanceDex.isZero());
    assert(balanceDai.toString() === web3.utils.toWei("1000"));
  });

  it("should not withdraw unknown token", async () => {
    await expectRevert(
      dex.withdraw(
        // Try to withdraw 100 of Fake Token
        web3.utils.toWei("100"),
        web3.utils.fromAscii("NON TOKEN"),
        { from: trader1 }
      ),
      "this token does not exist"
    );
  });
  it("should not withdraw token there are not enough", async () => {
    await expectRevert(
      dex.withdraw(
        // Try to withdraw 100 DAI from empty account
        web3.utils.toWei("100"),
        DAI,
        { from: trader1 }
      ),
      "balance too low"
    );
  });
  it("should create limit order", async () => {
    await dex.deposit(
      // send 100 DAI to dex contract from trader 1
      web3.utils.toWei("100"),
      DAI,
      { from: trader1 }
    );

    await dex.createLimitOrder(
      // Buy 10 REP at price 10 per REP
      REP,
      web3.utils.toWei("10"),
      10,
      cType.buyTokens,
      { from: trader1 }
    );

    let buyOrders = await dex.getOrders(REP, cType.buyTokens);
    let sellOrders = await dex.getOrders(REP, cType.sellTokens);
    assert(buyOrders.length === 1);
    assert(buyOrders[0].trader === trader1);

    // we use padRight to insert
    // zero's to match solidity
    assert(buyOrders[0].ticker === web3.utils.padRight(REP, 64));
    assert(buyOrders[0].price === "10");
    assert(buyOrders[0].amount === web3.utils.toWei("10"));
    assert(sellOrders.length === 0);

    await dex.deposit(
      // send 200 DAI to dex contract from trader 2
      // to test ordering algorithm in dex contract
      web3.utils.toWei("200"),
      DAI,
      { from: trader2 }
    );

    await dex.createLimitOrder(
      // Buy 10 REP at price of 11 per REP
      REP,
      web3.utils.toWei("10"),
      11,
      cType.buyTokens,
      { from: trader2 }
    );

    buyOrders = await dex.getOrders(REP, cType.buyTokens);
    sellOrders = await dex.getOrders(REP, cType.sellTokens);

    // buy order was added to array
    assert(buyOrders.length === 2);

    // algo changed the order of
    // buy order changed to trader2
    // trader2 offering a better price.
    assert(buyOrders[0].trader === trader2);
    assert(buyOrders[1].trader === trader1);
    assert(sellOrders.length === 0);

    await dex.createLimitOrder(
      // this limit order should go last in array
      // it is the cheapest at 9
      REP,
      web3.utils.toWei("10"),

      // original 200 added to dex
      // covers this order
      9,
      cType.buyTokens,
      { from: trader2 }
    );

    buyOrders = await dex.getOrders(REP, cType.buyTokens);
    sellOrders = await dex.getOrders(REP, cType.sellTokens);

    // array has 3 orders in it
    assert(buyOrders.length === 3);
    assert(buyOrders[0].trader === trader2);
    assert(buyOrders[1].trader === trader1);

    // last order is for 9 and just added
    assert(buyOrders[2].trader === trader2);
    assert(sellOrders.length === 0);
  });

  it("should not create limit for unknown token", async () => {
    await dex.deposit(
      // deposit 100 to dex contract from trader1
      web3.utils.toWei("100"),
      DAI,
      { from: trader1 }
    );

    await expectRevert(
      dex.createLimitOrder(
        // trying to trade a token that
        // doesn't exist
        web3.utils.fromAscii("NO TOKEN"),
        web3.utils.toWei("10"),
        10,
        cType.buyTokens,
        { from: trader1 }
      ),
      "this token does not exist"
    );

    let buyOrders = await dex.getOrders(REP, cType.buyTokens);
    let sellOrders = await dex.getOrders(REP, cType.sellTokens);
    assert(buyOrders.length === 0);
    assert(sellOrders.length === 0);
  });

  it("should not be DIA - cannot trade DIA", async () => {
    await dex.deposit(
      // deposit 100 to dex contract
      web3.utils.toWei("100"),
      DAI,
      { from: trader1 }
    );

    await expectRevert(
      dex.createLimitOrder(
        // trying to trade DAI
        DAI,
        web3.utils.toWei("10"),
        10,
        cType.buyTokens,
        { from: trader1 }
      ),
      "cannot trade DAI"
    );

    let buyOrders = await dex.getOrders(REP, cType.buyTokens);
    let sellOrders = await dex.getOrders(REP, cType.sellTokens);
    assert(buyOrders.length === 0);
    assert(sellOrders.length === 0);
  });

  it("should not create limit order if not enough tokens", async () => {
    await dex.deposit(
      // trader 1 deposits 100 REP
      web3.utils.toWei("100"),
      REP,
      { from: trader1 }
    );

    await expectRevert(
      dex.createLimitOrder(
        // trader only owns 100 REP
        // can not sell 110 REP
        // balance is to low (100 REP)
        REP,
        web3.utils.toWei("110"),
        10,
        cType.sellTokens,
        { from: trader1 }
      ),
      "token balance too low"
    );
  });

  it("should not create limit order if not enough dai", async () => {
    await dex.deposit(
      // trader 1 deposit 100 DAI
      web3.utils.toWei("100"),
      DAI,
      { from: trader1 }
    );

    await expectRevert(
      dex.createLimitOrder(
        REP,
        // trader onw trying to buy 12 REP
        // for 10 each. equals 120 DAI
        // trader only deposited 100 DAI
        web3.utils.toWei("12"),
        10,
        cType.buyTokens,
        { from: trader1 }
      ),
      "dai balance too low"
    );
  });

  it("should create market order that work with another order", async () => {
    await dex.deposit(
      // first trader1 deposits 100 dai to contract
      web3.utils.toWei("100"),
      DAI,
      { from: trader1 }
    );

    await dex.createLimitOrder(
      // second trader1 creates limit order
      // 10 rep at 10/coin
      REP,
      web3.utils.toWei("10"),
      10,
      cType.buyTokens,
      { from: trader1 }
    );

    await dex.deposit(
      // third trader2 deposits 100 rep to contract
      web3.utils.toWei("100"),
      REP,
      { from: trader2 }
    );

    await dex.createMarketOrder(
      // last trader2 creates a market order
      // to sell 5 rep
      REP,
      web3.utils.toWei("5"),
      cType.sellTokens,
      { from: trader2 }
    );

    const trader1DAI = await dex.traderBalances(trader1, DAI);
    const trader1REP = await dex.traderBalances(trader1, REP);
    const trader2DAI = await dex.traderBalances(trader2, DAI);
    const trader2REP = await dex.traderBalances(trader2, REP);

    const orders = await dex.getOrders(REP, cType.buyTokens);
    assert(orders[0].filled === web3.utils.toWei("5"));
    assert(trader1DAI.toString() === web3.utils.toWei("50"));
    assert(trader1REP.toString() === web3.utils.toWei("5"));
    assert(trader2DAI.toString() === web3.utils.toWei("50"));
    assert(trader2REP.toString() === web3.utils.toWei("95"));
  });

  it("should not create market order for unknown token", async () => {
    await expectRevert(
      dex.createMarketOrder(
        // trader1 trying to create market order
        // with unsupported token
        web3.utils.fromAscii("ADA"),
        web3.utils.toWei("5"),
        cType.sellTokens,
        { from: trader1 }
      ),
      "this token does not exist"
    );
  });

  it("should not create a market order for dai - cannot trade", async () => {
    await expectRevert(
      dex.createMarketOrder(
        // trader1 trying to trade dai
        DAI,
        web3.utils.toWei("5"),
        cType.sellTokens,
        { from: trader1 }
      ),
      "cannot trade DAI"
    );
  });

  it("should not create a market order not enough tokens to fill", async () => {
    await dex.deposit(
      // trader 2 is depositing 100 REP
      web3.utils.toWei("100"),
      REP,
      { from: trader2 }
    );

    await expectRevert(
      dex.createMarketOrder(
        // trader 2 trying to take out
        // more rep then she has
        REP,
        web3.utils.toWei("101"),
        cType.sellTokens,
        { from: trader2 }
      ),
      "token balance too low"
    );
  });
});
