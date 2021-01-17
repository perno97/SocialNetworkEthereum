var AccountManager = artifacts.require("./ACcountManager.sol");
var User = artifacts.require("./User.sol");

module.exports = function(deployer) {
  deployer.deploy(AccountManager).then(function(){
    //unused User deployment required for truffle-ganache to workd
    return deployer.deploy(User, AccountManager.address);
  });
};
