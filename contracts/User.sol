// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <=0.8.0;

contract User {
  //like an array of following User contracts' addresses
  mapping(uint => address) following;
  uint followingCount;
  //mapping of all possible addresses to a boolean value
  //the default boolean value result is false
  mapping(address => bool) isFollowing;
  //like an array of posts
  mapping(uint => Post) posts;
  uint postsCount;

  //storing this contract's owner address
  address payable owner;

  //custom type to manage posts
  struct Post {
    string content;
    string ipfsHash;
    string timeStamp;
  }

  //adds the specified code in every function using this modifier
  modifier onlyOwner{
    require(msg.sender == owner);
    _;//function's code will be placed at _
  }

  constructor(address _owner) {
    owner = payable(_owner);
  }

  //the memory keyword tells to store the strings in volatile memory
  function addPost(string memory _content, string memory _ipfsHash, string memory _timeStamp) public onlyOwner{
    //adds a Post variable to the mapping while incrementing the index
    //storage keyword tells to save the mapping in account's persistent storage
    //creating mappings in volatile memory is prohibited in this version of solidity
    //p is a pointer to the Post variable, so you set its values after
    Post storage p = posts[postsCount++];
    p.content = _content;
    p.ipfsHash = _ipfsHash;
    p.timeStamp = _timeStamp;
  }

  //the memory keyword tells to store the strings in volatile memory
  function getPost(uint _index) public view returns (string memory, string memory, string memory) {
    //index must be in interval and at least one post
    require(postsCount > 0 && _index >= 0 && _index < postsCount);
    Post memory p = posts[_index];
    return (p.content,p.ipfsHash,p.timeStamp);//single values can be loaded in memory
  }

  function getFollowing(uint _index) public view returns (address) {
    //index must be in interval and at least one following
    require(followingCount > 0 && _index >= 0 && _index < followingCount);
    return following[_index];
  }

  function addFollowing(address _follow) public onlyOwner{
    //can't follow myself and must not be already following
    require(_follow != owner && !isFollowing[_follow]);
    following[followingCount++] = _follow;
    isFollowing[_follow] = true;
  }

  function deleteFollowing(address _unfollow) public onlyOwner{
    //can't unfollow myself and must be following to unfollow
    require(_unfollow != owner && isFollowing[_unfollow]);
    for(uint i=0;i<followingCount;i++){
      if(following[i] == _unfollow) {
        //substitute removed with the last address
        //decreasing counter will make lsat unreachable and overwritten at next addFollowing
        following[i] = following[--followingCount];
        isFollowing[_unfollow] = false;
      }
    }
  }

  function checkIsFollowing(address _toCheck) public view returns (bool) {
    return isFollowing[_toCheck];
  }

  function getFollowingAddress(uint _index) public view returns (address) {
    //index must be in interval and at least one following
    require(followingCount > 0 && _index >= 0 && _index < followingCount);
    return following[_index];
  }

  function getPostsCount() public view returns (uint){
    return postsCount;
  }

  function getFollowingCount() public view returns (uint){
    return followingCount;
  }

  //executed when contract called with empty call data
  //for example to receive ether with plain transactions
  receive () external payable {}
}
