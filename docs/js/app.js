App = {
  web3Provider: null,
  contracts: {},
  userContractInstance: null,
  isRegistered: false,
  ipfs: null,

  //functions called on connect button click
  connect: function() {
    App.initWeb3();
  },

  initWeb3: async function() {
    // Modern dapp browsers...
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      try {
        // Request account access
        await window.ethereum.enable();
      } catch (error) {
        // User denied account access...
        console.error("User denied account access")
      }
    }
    // Legacy dapp browsers...
    else if (window.web3) {
      App.web3Provider = window.web3.currentProvider;
    }
    // If no injected web3 instance is detected, fall back to Ganache
    else {
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
    }
    web3 = new Web3(App.web3Provider);
    return App.initContract();
  },

  initContract: function() {
    $.getJSON("./contracts/User.json", function(user) {
      // Instantiate a new truffle contract from the artifact
      App.contracts.User = TruffleContract(user);
      // Connect provider to interact with contract
      App.contracts.User.setProvider(App.web3Provider);
    }).then(function() {
      $.getJSON("./contracts/AccountManager.json", function(accountManager) {
        // Instantiate a new truffle contract from the artifact
        App.contracts.AccountManager = TruffleContract(accountManager);
        // Connect provider to interact with contract
        App.contracts.AccountManager.setProvider(App.web3Provider);
        App.checkRegistration();
      });
    })
  },
  //END functions called on connect button click

  //functions called on register button click
  register: function() {
    App.accountManagerInstance.register().then(function() {
      App.checkRegistration();
    });
  },

  checkRegistration: function() {
    App.contracts.AccountManager.deployed().then(function(instance) {
      App.accountManagerInstance = instance;
      App.accountManagerInstance.isSenderRegistered().then(function(isRegistered) {
        App.isRegistered = isRegistered;
        App.render();
      });
    });
  },
  //END functions called on register button click

  //function called on login button click
  login: function() {
    // Load account data
    web3.eth.getCoinbase(function(err, account) {
      if (err === null) {
        App.account = web3.toChecksumAddress(account);
      }
    });

    App.contracts.AccountManager.deployed().then(function(instance) {
      App.accountManagerInstance = instance;
      App.accountManagerInstance.getThisUserAddress().then(function(address) {
        App.userContractAddress = web3.toChecksumAddress(address);
        return App.contracts.User.at(App.userContractAddress);
      }).then(function(instance) {
        App.userContractInstance = instance;
        App.render();
      });
    });
  },

  //function called on reload button click or when UI needs to be updated
  render: function() {
    $("#accountAddress").html("Your account: " + App.account);
    $("#userContractAddress").html("Your user contract:" + App.userContractAddress);

    //update status and enable/disable buttons
    if (App.web3Provider == null) {
      $("#isConnected").html("false");
      $("#isLogged").html("false");
      $("#isRegistered").html("false");
      $("#login").prop("disabled", true);
      $("#register").prop("disabled", true);
      $("#addPostDiv").hide();
      return;
    } else {
      $("#isConnected").html("true");
      if (App.isRegistered && App.ipfs != null) {
        $("#register").prop("disabled", true);
        $("#login").prop("disabled", false);
        $("#isRegistered").html("true");
      } else {
        $("#register").prop("disabled", false);
        $("#login").prop("disabled", true);
        $("#isRegistered").html("false");
      }
    }

    if (App.accountManagerInstance == null || App.userContractInstance == null) {
      $("#isLogged").html("false");
      return;
    } else {
      $("#isLogged").html("true");
      $("#addPostDiv").show();
    }

    //render posts
    App.userContractInstance.getPostsCount().then(async function(count) {
      var postTemplate = "<br>";
      for (var i = 0; i < count; i++) {
        postTemplate = await App.userContractInstance.getPost(i).then(function(post) {
          const ipfsHash = post[1];
          var result = App.ipfs.cat(ipfsHash);
          return result.next().then(function(r) {
            var string = new TextDecoder("utf-8").decode(r.value);
            var timestamp = getTimestampFormatted(post[2]);
            return "<tr><th>" + timestamp + "</th><td>" + post[0] + "</td><td>" + string + "</td></tr>" + postTemplate;
          }).catch(function(error) {
            console.warn(error);
          });
        });
      }
      $("#postsList").html(postTemplate);
    });

    //render followings
    App.userContractInstance.getFollowingCount().then(async function(count) {
      var followingTemplate = "";
      var address;
      for (var i = 0; i < count; i++) {
        address = web3.toChecksumAddress(await App.userContractInstance.getFollowing(i));
        followingTemplate = '<tr><td><a href="" onclick="App.onUnfollow(\'' + address + '\'); return false;">' + address + "</a></td></tr>" + followingTemplate;
      }
      $("#followingList").html(followingTemplate);
    });

    //render users
    App.accountManagerInstance.getUsersCount().then(async function(count) {
      var userAddress;
      var addressTemplate = "";
      for (var i = 0; i < count; i++) {
        userAddress = web3.toChecksumAddress(await App.accountManagerInstance.getUserAddress(i));
        if (userAddress == App.userContractInstance.contract.address) {
          addressTemplate = "<tr><td>" + userAddress + " - (this)</td></tr>" + addressTemplate;
        } else {
          addressTemplate = '<tr><td><a href="" onclick="App.onFollow(\'' + userAddress + '\'); return false;">' + userAddress + "</a></td></tr>" + addressTemplate;
        }
      }
      $("#usersList").html(addressTemplate);
    });
  },

  //function called on add post button click
  addPost: async function() {
    if (App.userContractInstance == null) return;
    const newPostText = $("#newPostText").val();
    const contentToIpfs = $("#contentToIpfs").val();

    const result = await App.ipfs.add(contentToIpfs);
    newPostIpfsHash = result.cid.string;
    var newPostTimestamp = "" + new Date().getTime();
    App.userContractInstance.addPost(newPostText, newPostIpfsHash, newPostTimestamp).then(function() {
      App.render();
    });
  },

  //function called when clicking on user address link
  onFollow: function(address) {
    App.userContractInstance.addFollowing(address).then(function() {
      App.render();
    });
  },

  //function called when clicking on following address link
  onUnfollow: function(address) {
    App.userContractInstance.deleteFollowing(address).then(function() {
      App.render();
    });
  }
};

function getTimestampFormatted(timestamp) {
  var today = new Date(parseInt(timestamp));
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  var hour = today.getHours();
  var min = today.getMinutes();
  var sec = today.getSeconds();
  if (dd < 10) dd = '0' + dd;
  if (mm < 10) mm = '0' + mm;
  if (hour < 10) hour = '0' + hour;
  if (min < 10) min = '0' + min;
  if (sec < 10) sec = '0' + sec;

  return mm + '/' + dd + '/' + yyyy + " - " + hour + ":" + min + ":" + sec;
}

//initialize ipfs and update UI at startup (disabling buttons)
$(document).ready(function() {
  Ipfs.create({
    repo: 'ipfs-' + Math.random()
  }).then(function(result) {
    App.ipfs = result;
  });
  App.render();
});
