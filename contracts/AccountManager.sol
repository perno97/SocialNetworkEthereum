// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <=0.8.0;
import "./User.sol";

contract AccountManager {
  mapping(address => address) users;
  mapping(uint => address) usersList;
  uint usersCount;
  mapping(address => bool) registered;

  address payable owner;

  constructor() {
    owner = payable(msg.sender);
  }

  function register() public {
    require(!registered[msg.sender]);
    User u = (new User(msg.sender));
    users[msg.sender] = address(u);
    usersList[usersCount++]=address(u);
    registered[msg.sender] = true;
  }

  function isSenderRegistered() public view returns (bool){
    return registered[msg.sender];
  }

  function getThisUserAddress() public view returns (address){
    return users[msg.sender];
  }

  function getUserAddress(uint _index) public view returns (address){
    require(usersCount > 0 && _index < usersCount);
    return usersList[_index];
  }

  function getUsersCount() public view returns (uint){
    return usersCount;
  }

  receive () external payable {}

  fallback () external payable{}
}
