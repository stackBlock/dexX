pragma solidity 0.6.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Eco is ERC20 {
    constructor() public ERC20("ECO", "Econ token") {}

    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
