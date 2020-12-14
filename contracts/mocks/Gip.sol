pragma solidity 0.6.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Gip is ERC20 {
    constructor() public ERC20("GIP", "Gipper token") {}

    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
