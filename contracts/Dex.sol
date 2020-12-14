pragma solidity 0.6.3;
pragma experimental ABIEncoderV2;

// imported into library
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Dex {
    // use safemath for the rollover issue with numbers
    using SafeMath for uint256;


    // ********** VARIABLE ****

    bytes32[] public tokenList;
    address public admin;
    uint256 public nextOrderId;
    uint256 public nextTradeId;
    bytes32 constant DAI = bytes32("DAI");


    // ********** ENUM ****

    // 2 order types buyTokens and sellTokens
    enum Side {buyTokens, sellTokens}


    // ********** STRUCTS ****

    // token struct has the ticker 
    // token address
    struct Token {
        bytes32 ticker;
        address tokenAddress;
    }
    
    // order includes id of the order
    // person making the trade
    // whether it is a buy or sell trade
    // token you are trading
    // number of tokens in the order
    // how much of the order is filled (# of tokens)
    // price paid for each token
    // date
    struct Order {
        uint256 id;
        address trader;
        Side side;
        bytes32 ticker;
        uint256 amount;
        uint256 filled;
        uint256 price;
        uint256 date;
    }


    // ********** MAPPINGS ****

    // tokens are mapped to their ticker
    mapping(bytes32 => Token) public tokens;

    // trader balance is mappped to their address
    // and then to the ticker
    // and dinally the balance of the token
    mapping(address => mapping(bytes32 => uint256)) public traderBalances;

    // order book is mapped to the ticker
    // and then to the side
    // and then to the orders
    mapping(bytes32 => mapping(uint256 => Order[])) public orderBook;


    // ********** EVENTS ****
    
    // ecent includes the trade id
    // the order number
    // ticker
    // the traders
    // the amount
    // price of th token
    // date
    event NewTrade(
        uint256 tradeId,
        uint256 orderId,
        bytes32 indexed ticker,
        address indexed trader1,
        address indexed trader2,
        uint256 amount,
        uint256 price,
        uint256 date
    );


    // ********** START OF APPLICATION LOGIC ****

    constructor() public {
        admin = msg.sender;
    }


    // ********** FUNCTIONS ****

    function getOrders(bytes32 ticker, Side side)
        // simple function that returns an array of orders
        // buy or sell orders
        external
        view
        returns (Order[] memory)
    {
        return orderBook[ticker][uint256(side)];
    }

    function getTokens() external view returns (Token[] memory) {
        // returns a list of the current tokens
        // by getting the length of the list 
        // and adding each token onto an array (_tokens)
        Token[] memory _tokens = new Token[](tokenList.length);
        for (uint256 i = 0; i < tokenList.length; i++) {
            _tokens[i] = Token(
                tokens[tokenList[i]].ticker,
                tokens[tokenList[i]].tokenAddress
            );
        }
        return _tokens;
    }

    function addToken(bytes32 ticker, address tokenAddress)
        // this function adds a token to the contract
        // only the admin can call this function
        external
        onlyAdmin()
    {
        tokens[ticker] = Token(ticker, tokenAddress);
        tokenList.push(ticker);
    }

    function deposit(uint256 amount, bytes32 ticker)
        // this function deposit token into the contract 
        // by the msg.sender
        // checks to make sure the token exists
        external
        tokenExist(ticker)
    {
        IERC20(tokens[ticker].tokenAddress).transferFrom(
            msg.sender,
            address(this),
            amount
        );
        traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker]
            .add(amount);
    }

    function withdraw(uint256 amount, bytes32 ticker)
        // this function lets traders retrive
        // their tokens after they have traded
        // or any remaining from the deposit
        external
        tokenExist(ticker)
    {
        require(
            traderBalances[msg.sender][ticker] >= amount,
            "balance too low"
        );
        traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker]
            .sub(amount);
        IERC20(tokens[ticker].tokenAddress).transfer(msg.sender, amount);
    }

    function createLimitOrder(
        // this lets the trader create an order 
        // that will be proccessed when the 
        // condidions are met.
        // needs liquidity
        bytes32 ticker,
        uint256 amount,
        uint256 price,
        Side side
    ) external tokenExist(ticker) tokenIsNotDai(ticker) {
        if (side == Side.sellTokens) {
            // checks to make sure trader the token is 
            // available to be traded (in the contract)
            require( 
                traderBalances[msg.sender][ticker] >= amount,
                "token balance too low"
            );
        } else {
            require(
                // check to make sure the trader has a 
                // high enough balance DAI to buy tokens
                traderBalances[msg.sender][DAI] >= amount.mul(price),
                "dai balance too low"
            );
        }
        Order[] storage orders = orderBook[ticker][uint256(side)];
        orders.push(
            Order(nextOrderId, msg.sender, side, ticker, amount, 0, price, now)
        );
        // this is a bubble sort algorithm
        // compares t2 numbers and moves the 
        // highest number to the top
        // in this case price so those
        // orders get filled first
        uint256 i = orders.length > 0 ? orders.length - 1 : 0;
        while (i > 0) {
            if (
                side == Side.buyTokens && orders[i - 1].price > orders[i].price
            ) {
                break;
            }
            if (
                side == Side.sellTokens && orders[i - 1].price < orders[i].price
            ) {
                break;
            }
            Order memory order = orders[i - 1];
            orders[i - 1] = orders[i];
            orders[i] = order;
            i--;
        }
        nextOrderId++;
    }

    function createMarketOrder(
        // this function allows traders 
        // to buy and sell tokens
        // at the current price as long
        // as there is liquidity
        bytes32 ticker,
        uint256 amount,
        Side side
    ) external tokenExist(ticker) tokenIsNotDai(ticker) {
        if (side == Side.sellTokens) {
            // make sure the balance on the token is
            // high enough to sell
            require(
                traderBalances[msg.sender][ticker] >= amount,
                "token balance too low"
            );
        }
        Order[] storage orders = orderBook[ticker][uint256(
            side == Side.buyTokens ? Side.sellTokens : Side.buyTokens
        )];
        uint256 i;
        uint256 remaining = amount;

        while (i < orders.length && remaining > 0) {
            // make sure the orders are filled
            // before moving to another order
            uint256 available = orders[i].amount.sub(orders[i].filled);
            uint256 matched = (remaining > available) ? available : remaining;
            remaining = remaining.sub(matched);
            orders[i].filled = orders[i].filled.add(matched);
            // sending the order after it has been filled
            emit NewTrade(
                nextTradeId,
                orders[i].id,
                ticker,
                orders[i].trader,
                msg.sender,
                matched,
                orders[i].price,
                now
            );
            if (side == Side.sellTokens) {
                // these are correcting the amount of tokens
                // the trader has after they buy or sell.
                // It looks very jumbled because I used
                // a lot of SafeMath in here
                traderBalances[msg.sender][ticker] = traderBalances[msg
                    .sender][ticker]
                    .sub(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg
                    .sender][DAI]
                    .add(matched.mul(orders[i].price));
                traderBalances[orders[i]
                    .trader][ticker] = traderBalances[orders[i].trader][ticker]
                    .add(matched);
                traderBalances[orders[i].trader][DAI] = traderBalances[orders[i]
                    .trader][DAI]
                    .sub(matched.mul(orders[i].price));
            }
            if (side == Side.buyTokens) {
                require(
                    traderBalances[msg.sender][DAI] >=
                        matched.mul(orders[i].price),
                    "dai balance too low"
                );
                traderBalances[msg.sender][ticker] = traderBalances[msg
                    .sender][ticker]
                    .add(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg
                    .sender][DAI]
                    .sub(matched.mul(orders[i].price));
                traderBalances[orders[i]
                    .trader][ticker] = traderBalances[orders[i].trader][ticker]
                    .sub(matched);
                traderBalances[orders[i].trader][DAI] = traderBalances[orders[i]
                    .trader][DAI]
                    .add(matched.mul(orders[i].price));
            }
            nextTradeId++;
            i++;
        }
            // pops off old orders from the array
        i = 0;
        while (i < orders.length && orders[i].filled == orders[i].amount) {
            for (uint256 j = i; j < orders.length - 1; j++) {
                orders[j] = orders[j + 1];
            }
            orders.pop();
            i++;
        }
    }


    // ********** MODIFIERS ****

    modifier tokenIsNotDai(bytes32 ticker) {
        // make sure DAI is not traded
        require(ticker != DAI, "cannot trade DAI");
        _;
    }

    modifier tokenExist(bytes32 ticker) {
        // make sure the token exists
        require(
            tokens[ticker].tokenAddress != address(0),
            "this token does not exist"
        );
        _;
    }

    modifier onlyAdmin() {
        // make sure the admin is only allowed
        require(msg.sender == admin, "only admin");
        _;
    }
}
