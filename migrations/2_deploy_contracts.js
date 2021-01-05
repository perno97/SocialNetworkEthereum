var AccountManager = artifacts.require("./ACcountManager.sol");
var User = artifacts.require("./User.sol");

module.exports = function(deployer) {
  deployer.deploy(AccountManager);
  //unused User deployment required for truffle-ganache to work
  deployer.deploy(User, "0x0000000000000000000000000000000000000000");
};
