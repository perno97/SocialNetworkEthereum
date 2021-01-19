//used storing and ordering posts
class Post{
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

  //shows or hides the status div on page
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

  //loads contracts json files to initiate TruffleContract objects
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

  //updates registered status
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

    //saves an instance of current User contract in order to call contract's methods later
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

  //resets the UI and some state variables when clicking connect button
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

    //show login button and posts if logged
    if (App.accountManagerInstance == null || App.userContractInstance == null) {
      $("#isLogged").html("false");
      return;
    } else {
      $("#isLogged").html("true");
      $("#addPostDiv").show();
    }

    //loading posts may take a moment, so a loading text is shown
    App.showLoading(true);

    //render followings and load their posts
    App.posts = [];
    App.userContractInstance.getFollowingCount().then(async function(count) {
      if(count == 0) {//if there are no followings then show only current user's posts
        $("#followingList").html("");
        App.loadCurrentUserPosts();
        return;
      }
      var followingTemplate = "";
      var address;
      for (let i = 0; i < count; i++) {//get the address of each following
        address = web3.toChecksumAddress(await App.userContractInstance.getFollowing(i));
        followingTemplate = '<tr><td><a href="" onclick="App.onUnfollow(\'' + address +
        '\'); return false;">' + address + "</a></td></tr>" + followingTemplate;
        let countPosts = await App.contracts.User.at(address).getPostsCount();
        for (let j = 0; j < countPosts; j++) {//load all posts of each following
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
        if (userAddress == App.userContractInstance.contract.address) {//if it's current user's then add "- (this)"
          addressTemplate = "<tr><td>" + userAddress + " - (this)</td></tr>" + addressTemplate;
        } else {
          addressTemplate = '<tr><td><a href="" onclick="App.onFollow(\'' + userAddress + '\'); return false;">' + userAddress + "</a></td></tr>" + addressTemplate;
        }
      }
      $("#usersList").html(addressTemplate);
    });
  },

  loadCurrentUserPosts: function(){
    App.userContractInstance.getPostsCount().then(async function(count) {
      for (var i = 0; i < count; i++) {
        postTemplate = await App.userContractInstance.getPost(i).then(async function(post) {
          await App.pushPost(App.userContractAddress,post);
        });
      }
      App.showLoading(false);//at this point all posts are loaded
      App.renderPosts();
    });
  },

  //loads IPFS content if present, then stores a new Post object in posts array
  pushPost: async function(address,post){
    var ipfsContent = "<td></td>";
    let ipfsHash = post[1];
    if(ipfsHash.length != 0){
      for await(const dir of App.ipfs.ls(ipfsHash)){//this part is executed asynchronously
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
    //at this point all posts are loaded so they must be ordered by timestamp
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
      //conver timestamp into human readable date-time
      var timestamp = getTimestampFormatted(post.timeStamp);

      //posts are rendered from the first to the last, from bottom to the top of the page, so
      //if the post author changes then add the previousAuthor row
      //if this is the first post, so at the bottom, then don't add a previousAuthor row, because there aren't previous posts
      if(previousAuthor !== post.author && i != 0){
        if(previousAuthor === App.userContractAddress){//if this user is the author to render then use different style
          authorTemplate = "<tr><td class='author authorMe' colspan=3>" + previousAuthor + " - (this)</td></tr>";
        }
        else{
          authorTemplate = "<tr><td class='author' colspan=3>" + previousAuthor + "</td></tr>";
        }
        postTemplate = authorTemplate + postTemplate;//add authorTemplate in front of postTemplate, to show it above the rest of the rows
      }
      //add the post content row, the author will be added later
      postTemplate = "<tr><th class='timestamp'>" + timestamp + "</th><td class='content'>" + post.content +
      "</td>" + post.ipfsLink + "</tr>" + postTemplate;

      //if this is the last post, then add the author row of the current post
      if(i == App.posts.length-1){
        if(post.author === App.userContractAddress){//if this user is the author to render then use different style
          authorTemplate = "<tr><td class='author authorMe' colspan=3>" + post.author + " - (this)</td></tr>";
        }
        else{
          authorTemplate = "<tr><td class='author' colspan=3>" + post.author + "</td></tr>";
        }
        postTemplate = authorTemplate + postTemplate;//add authorTemplate in front of postTemplate, to show it above the rest of the rows
      }
      //update previousAuthor for next cycle and UI
      previousAuthor = post.author;
      $("#postsList").html(postTemplate);
    });
  },

  //switch showing loading text/showing posts
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
    if (App.userContractInstance == null) return;//stop if not logged
    const newPostText = $("#newPostText").val();
    const files = $("#contentToIpfs").prop('files');

    if(files.length == 0 && newPostText.length == 0) return;//stop if nothing to add

    if(files.length != 0) {
      let file = files[0];//get the object representing the file to load

      const reader = new FileReader();
      reader.addEventListener('load', async function(event) {//call this on file loaded
        const content = event.target.result;//file content
        const result = await App.ipfs.add(//add file to IPFS as member of a directory, so you can get filename later
          [{
            path: "/files/" + file.name,
            content: content
          }]
        );
        newPostIpfsHash = result.cid.string;
        App.sendAddPost(newPostText,newPostIpfsHash);
      });
      reader.readAsArrayBuffer(file);//launch file reading
    }
    else{//if there's only text content and no attachment to add
      App.sendAddPost(newPostText, "");
    }
  },

  //calls contract method for adding posts
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
    repo: 'ipfs-' + Math.random()//create a repository with random name
  }).then(function(result) {
    App.ipfs = result;
  });
  App.render();
});
