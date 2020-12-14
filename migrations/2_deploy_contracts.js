// importing coin contracts
const Dai = artifacts.require("mocks/Dai.sol");
const Rig = artifacts.require("mocks/Rig.sol");
const Tun = artifacts.require("mocks/Tun.sol");
const Zrx = artifacts.require("mocks/Zrx.sol");
const Ada = artifacts.require("mocks/Ada.sol");
const Eco = artifacts.require("mocks/Eco.sol");
const Van = artifacts.require("mocks/Van.sol");
const Dex = artifacts.require("Dex.sol");

// creating tickers
const DAI = web3.utils.fromAscii("DAI");
const RIG = web3.utils.fromAscii("RIG");
const TUN = web3.utils.fromAscii("TUN");
const ZRX = web3.utils.fromAscii("ZRX");
const ADA = web3.utils.fromAscii("ADA");
const ECO = web3.utils.fromAscii("ECO");
const VAN = web3.utils.fromAscii("VAN");

module.exports = async function(deployer, network, accounts) {

    const [trader1, trader2, trader3, trader4, _] = accounts;

    await deployer.deploy(Dai);
    await deployer.deploy(Rig);
    await deployer.deploy(Tun);
    await deployer.deploy(Zrx);
    await deployer.deploy(Ada);
    await deployer.deploy(Eco);
    await deployer.deploy(Van);
    await deployer.deploy(Dex);

    const dai = await Dai.deployed();
    const rig = await Rig.deployed();
    const tun = await Tun.deployed();
    const zrx = await Zrx.deployed();
    const ada = await Ada.deployed();
    const eco = await Eco.deployed();
    const van = await Van.deployed();
    const dex = await Dex.deployed();

    await dex.addToken(DAI, dai.address);
    await dex.addToken(RIG, rig.address);
    await dex.addToken(TUN, tun.address);
    await dex.addToken(ZRX, zrx.address);
    await dex.addToken(ADA, ada.address);
    await dex.addToken(ECO, eco.address);
    await dex.addToken(VAN, van.address);

    const amount = web3.utils.toWei("1000");
    const seedTokenBalance = async (token, trader) => {
      await token.faucet(trader, amount);
      await token.approve(dex.address, amount, { from: trader });
      const ticker = await token.name();
      await dex.deposit(
          amount,
          web3.utils.fromAscii(ticker),
          {from: trader}
      )
    };

    await seedTokenBalance(dai, trader1);
    await seedTokenBalance(rig, trader1);
    await seedTokenBalance(tun, trader1);
    await seedTokenBalance(zrx, trader1);
    await seedTokenBalance(ada, trader1);
    await seedTokenBalance(eco, trader1);
    await seedTokenBalance(van, trader1);

    await seedTokenBalance(dai, trader2);
    await seedTokenBalance(rig, trader2);
    await seedTokenBalance(tun, trader2);
    await seedTokenBalance(zrx, trader2);
    await seedTokenBalance(ada, trader2);
    await seedTokenBalance(eco, trader2);
    await seedTokenBalance(van, trader2);

    await seedTokenBalance(dai, trader3);
    await seedTokenBalance(rig, trader3);
    await seedTokenBalance(tun, trader3);
    await seedTokenBalance(zrx, trader3);
    await seedTokenBalance(ada, trader3);
    await seedTokenBalance(eco, trader3);
    await seedTokenBalance(van, trader3);

    await seedTokenBalance(dai, trader3);
    await seedTokenBalance(rig, trader3);
    await seedTokenBalance(tun, trader3);
    await seedTokenBalance(zrx, trader3);
    await seedTokenBalance(ada, trader3);
    await seedTokenBalance(eco, trader3);
    await seedTokenBalance(van, trader3);
}