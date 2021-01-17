Post = class Post{
  constructor(author,content,ipfsLink,timeStamp){
    this.author=author;
    this.content=content;
    this.ipfsLink=ipfsLink;
    this.timeStamp=timeStamp;
  }
};

App = {
  web3Provider: null,
  contracts: {},
  userContractInstance: null,
  isRegistered: false,
  ipfs: null,
  posts: [],
  showingStatus: true,

  toggleStatus: function(){
    App.showingStatus?$("#status").hide():$("#status").show();
    App.showingStatus = !App.showingStatus;
  },

  //functions called on connect button click
  connect: function() {
    App.reset();
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
    App.checkRegistration();
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

  reset: function(){
    App.web3Provider = null;
    App.contracts = {};
    App.userContractInstance = null;
    App.isRegistered = false;
    App.posts = [];
    $("#postsList").html("");
    $("#followingList").html("");
    $("#usersList").html("");
    App.render();
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

    App.showLoading(true);
    //render followings and load their posts
    App.posts = [];
    App.userContractInstance.getFollowingCount().then(async function(count) {
      if(count == 0) {
        $("#followingList").html("");
        App.loadCurrentUserPosts();
        return;
      }
      var followingTemplate = "";
      var address;
      for (let i = 0; i < count; i++) {
        address = web3.toChecksumAddress(await App.userContractInstance.getFollowing(i));
        followingTemplate = '<tr><td><a href="" onclick="App.onUnfollow(\'' + address + '\'); return false;">' + address + "</a></td></tr>" + followingTemplate;
        let countPosts = await App.contracts.User.at(address).getPostsCount();
        for (let j = 0; j < countPosts; j++) {
          let post = await App.contracts.User.at(address).getPost(j);
          await App.pushPost(address,post);
        }
      }
      $("#followingList").html(followingTemplate);
      App.loadCurrentUserPosts();
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

  loadCurrentUserPosts: function(){
    //load current user posts
    App.userContractInstance.getPostsCount().then(async function(count) {
      for (var i = 0; i < count; i++) {
        postTemplate = await App.userContractInstance.getPost(i).then(async function(post) {
          await App.pushPost(App.userContractAddress,post);
        });
      }
      App.showLoading(false);
      App.renderPosts();
    });
  },

  pushPost: async function(address,post){
    var ipfsContent = "<td></td>";
    let ipfsHash = post[1];
    if(ipfsHash.length != 0){
      for await(const dir of App.ipfs.ls(ipfsHash)){
        debugger;
        //controllo se allegato presente
        filename=dir.name;
        if(filename.length != 0){
          ipfsContent = "<td class='attachment'><a href='https://ipfs.io/ipfs/" + ipfsHash +
          "' target=_blank>" + filename + "</a></td>";
        }
        App.posts.push(new Post(address,post[0],ipfsContent,post[2]));
      }
    }
    else{
      App.posts.push(new Post(address,post[0],ipfsContent,post[2]));
    }
  },

  renderPosts: async function(){
    if(App.posts.length > 1) {
      for(let i=0;i<App.posts.length-1;i++){
        for(let j=1;j<App.posts.length;j++){
          if(App.posts[j-1].timeStamp > App.posts[j].timeStamp){
            let aux = App.posts[j];
            App.posts[j] = App.posts[j-1];
            App.posts[j-1] = aux;
          }
        }
      }
    }
    //render posts
    var postTemplate = "<br>";
    var filename = "";
    var previousAuthor = "";
    var authorTemplate;
    App.posts.forEach(async function(post, i) {
      authorTemplate = "";
      //conversione timestamp
      var timestamp = getTimestampFormatted(post.timeStamp);

      //controllo se l'autore del nuovo post e' diverso dal precedente e se non è il primo post
      if(previousAuthor !== post.author && i != 0){
        //autore diverso, allora inserisco la riga dell'autore per i post precedenti
        if(previousAuthor === App.userContractAddress){
          authorTemplate = "<tr><td class='author authorMe' colspan=3>" + previousAuthor + " - (this)</td></tr>";
        }
        else{
          authorTemplate = "<tr><td class='author' colspan=3>" + previousAuthor + "</td></tr>";
        }
        postTemplate = authorTemplate + postTemplate;
      }
      //inserisco il nuovo post e l'eventuale aggiunta della riga autore va al passaggio successivo
      postTemplate = "<tr><th class='timestamp'>" + timestamp + "</th><td class='content'>" + post.content +
      "</td>" + post.ipfsLink + "</tr>" + postTemplate;

      //se e' l'ultimo post devo aggiungere la riga dell'autore attuale
      if(i == App.posts.length-1){
        if(post.author === App.userContractAddress){
          authorTemplate = "<tr><td class='author authorMe' colspan=3>" + post.author + " - (this)</td></tr>";
        }
        else{
          authorTemplate = "<tr><td class='author' colspan=3>" + post.author + "</td></tr>";
        }
        postTemplate = authorTemplate + postTemplate;
      }
      //aggiorno per ciclo successivo
      previousAuthor = post.author;
      $("#postsList").html(postTemplate);
    });
  },

  showLoading: function(isLoading){
    if(isLoading){
      $("#loading").show();
      $("#postsList").hide();
    }
    else{
      $("#loading").hide();
      $("#postsList").show();
    }
  },

  //function called on add post button click
  addPost: async function() {
    if (App.userContractInstance == null) return;
    const newPostText = $("#newPostText").val();
    const files = $("#contentToIpfs").prop('files');

    if(files.length == 0 && newPostText.length == 0) return;

    if(files.length != 0) {
      let file = files[0];

      const reader = new FileReader();
      reader.addEventListener('load', async function(event) {
        const content = event.target.result;
        const result = await App.ipfs.add(
          [{
            path: "/files/" + file.name,
            content: content
          }]
        );
        newPostIpfsHash = result.cid.string;
        console.log(newPostIpfsHash);
        App.sendAddPost(newPostText,newPostIpfsHash);
      });
      reader.readAsArrayBuffer(file);
    }
    else{
      App.sendAddPost(newPostText, "");
    }
  },

  sendAddPost: function(newPostText, newPostIpfsHash){
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
