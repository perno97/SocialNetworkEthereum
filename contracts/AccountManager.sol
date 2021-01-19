// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <=0.8.0;
import "./User.sol";

contract AccountManager {
  //mapping user's account address to his User contract address
  mapping(address => address) users;
  //like an array of registered User contracts' addresses
  mapping(uint => address) usersList;
  //amount of addresses registered
  uint usersCount;
  //mapping of all possible addresses to a boolean value
  //the default boolean value result is false
  mapping(address => bool) registered;

  //storing this contract's owner address
  address payable owner;

  constructor() {
    owner = payable(msg.sender);
  }

  function register() public {
    require(!registered[msg.sender]);//user can't register if already registered
    //creates new User contract, generating its address from sender address
    User u = (new User(msg.sender));
    users[msg.sender] = address(u);//add the new mapping user-User contract
    usersList[usersCount++]=address(u);//add the contract address in the list
    registered[msg.sender] = true;//set this user address as registered
  }

  function isSenderRegistered() public view returns (bool){
    return registered[msg.sender];
  }

  //returns sender's User contract's address
  function getThisUserAddress() public view returns (address){
    return users[msg.sender];
  }

  function getUserAddress(uint _index) public view returns (address){
    //index must be in interval and at least one user
    require(usersCount > 0 && _index >= 0 && _index < usersCount);
    return usersList[_index];
  }

  function getUsersCount() public view returns (uint){
    return usersCount;
  }

  receive () external payable {}

  fallback () external payable{}
}
