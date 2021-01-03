// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <=0.8.0;

contract User {
  mapping(uint => address) following;
  uint followingCount;
  mapping(address => bool) isFollowing;
  address payable owner;
  mapping(uint => Post) posts;
  uint postsCount;

  struct Post {
    string content;
    string ipfsHash;
    string timeStamp;
  }

  modifier onlyCreator{
    require(msg.sender == owner);
    _;
  }

  constructor(address _owner) {
    owner = payable(_owner);
  }

  function addPost(string memory _content, string memory _ipfsHash, string memory _timeStamp) public onlyCreator{
    Post storage p = posts[postsCount++];
    p.content = _content;
    p.ipfsHash = _ipfsHash;
    p.timeStamp = _timeStamp;
  }

  function getPost(uint _index) public view returns (string memory, string memory, string memory) {
    require(postsCount > 0 && _index < postsCount);
    Post memory p = posts[_index];
    return (p.content,p.ipfsHash,p.timeStamp);
  }

  function getFollowing(uint _index) public view returns (address) {
    require(followingCount > 0 && _index < followingCount);
    return following[_index];
  }

  function addFollowing(address _follow) public onlyCreator{
    require(_follow != owner);
    following[followingCount++] = _follow;
    isFollowing[_follow] = true;
  }

  function deleteFollowing(address _unfollow) public onlyCreator{
    require(_unfollow != owner);
    require(isFollowing[_unfollow]);
    for(uint i=0;i<followingCount;i++){
      if(following[i] == _unfollow) {
        following[i] = following[--followingCount];
        isFollowing[_unfollow] = false;
      }
    }
  }

  function checkIsFollowing(address _toCheck) public view returns (bool) {
    return isFollowing[_toCheck];
  }

  function getFollowingAddress(uint _index) public view returns (address) {
    require(_index < followingCount);
    return following[_index];
  }

  function getPostsCount() public view returns (uint){
    return postsCount;
  }

  function getFollowingCount() public view returns (uint){
    return followingCount;
  }

  receive () external payable {}

  fallback () external payable {}
}
