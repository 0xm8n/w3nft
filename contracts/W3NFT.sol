// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "erc721a/contracts/extensions/ERC721AQueryable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "./TimeMint.sol";
import "./lib/EIP712Whitelisting.sol";

contract W3NFT is
    ERC721AQueryable,
    VRFConsumerBaseV2,
    EIP712Whitelisting,
    TimeMint
{
    using Address for address;

    struct chainlinkParams {
        address coordinator;
        bytes32 keyHash;
        uint32 subId;
    }

    address private teamWallet;
    string public preURI;
    string public baseURI;

    VRFCoordinatorV2Interface private COORDINATOR;
    bytes32 public keyHash;
    uint64 private sSubId;
    uint256 private sReqId;
    uint256 public seed;
    bool public revealed;

    constructor(
        string memory name,
        string memory symbol,
        chainlinkParams memory chainlink,
        address wallet
    )
        ERC721A(name, symbol)
        VRFConsumerBaseV2(chainlink.coordinator)
    {
        COORDINATOR = VRFCoordinatorV2Interface(chainlink.coordinator);
        keyHash = chainlink.keyHash;
        sSubId = chainlink.subId;
        teamWallet = wallet;
    }

    modifier secureMint(uint256 amount) {
        require(!msg.sender.isContract(), "Contract is not allowed");
        SaleState _saleState = getState();
        require( _saleState == SaleState.PrivateOn || _saleState == SaleState.PublicOn, "Sale not available");
        require(_totalMinted() + amount <= MAX_SUPPLY, "Exceed max supply");
        require(amount <= txCappedByMode(), "Exceed transaction limit");
        require(!isWalletCappedByMode(msg.sender, amount), "Exceed wallet limit");
        require(msg.value >= amount * priceByMode(), "Insufficient funds");
        require(mintedByMode() + amount <= cappedByMode(), "Purchase exceed sale capped");
        _;
    }

    function mintToken(uint256 amount, bytes calldata signature)
        external payable secureMint(amount)
    {
        SaleState _saleState = getState();
        if (_saleState == SaleState.PrivateOn) {
            require(isEIP712WhiteListed(signature), "Not whitelisted");
            _setAux(msg.sender, uint64(_getAux(msg.sender) + amount));
            privateMinted += amount;
        }
        if (_saleState == SaleState.PublicOn) {
            if (qBaseMint) require(isEIP712WhiteListed(signature), "Not Queued");
            publicMinted += amount;
        }
        _mint(msg.sender, amount);
    }
    
    function airdrop(address[] memory addresses, uint256 amount) external onlyOwner {
        require(
            _totalMinted() + (addresses.length * amount) <= MAX_SUPPLY,
            "Exceed max supply limit"
        );
        require(
            reserveMinted + (addresses.length * amount) <= maxReserve,
            "Insufficient reserve"
        );

        for (uint256 i = 0; i < addresses.length; i++) {
            _mint(addresses[i], amount);
        }
        reserveMinted += (addresses.length * amount);
    }

    function setBaseURI(string memory uri) external onlyOwner {
        baseURI = uri;
    }

    function reveal() external onlyOwner {
        require(seed > 0, "Random seed not recieved");
        revealed = true;
    }

    function setPreURI(string memory uri) external onlyOwner {
        preURI = uri;
    }

    function randomSeed(uint256 randomNum) external onlyOwner {
        require(!revealed, "Metadata is freezed");
        require(seed == 0, "Random seed already recieved");
        seed = uint256(keccak256(
            abi.encode(
                block.timestamp,
                block.number,
                block.coinbase,
                blockhash(block.number),
                randomNum
            )
        ));
    }

    function requestRandomWords() external onlyOwner {
        require(!revealed, "Metadata is freezed");
        sReqId = COORDINATOR.requestRandomWords(
        keyHash,
        sSubId,
        3, // requestConfirmations,
        100000,
        1 // numWords
        );
    }

    function fulfillRandomWords(
        uint256,
        uint256[] memory randomWords
    ) internal override {
        if(!revealed) seed = randomWords[0];
    }

    function withdraw(address wallet) external onlyOwner {
        require(wallet == teamWallet, "Only team wallet allow");
        payable(wallet).transfer(address(this).balance);
    }

    function setTeamWallet(address wallet) external onlyOwner {
        teamWallet = wallet;
    }

    function _startTokenId() internal view override virtual returns (uint256) {
        return 1;
    }

    function metaId(uint256 id) public view returns (string memory) {
        uint256 randSeed = seed;
        uint256 maxSupply = MAX_SUPPLY;
        uint256 vaultReserve = VAULT_RESERVE;
        if (msg.sender != owner()) {
            require(id <= _totalMinted(), "Not existed");
        }
        if (randSeed == 0) return "pre";

        uint256[] memory metadata = new uint256[](maxSupply+1);
        for (uint256 i = 1; i <= maxSupply ; i++) {
            metadata[i] = i;
        }
        for (uint256 j = vaultReserve+1; j <= maxSupply ; j++) {
            uint256 k = ((randSeed/j) % maxSupply)+1;
            if(k > vaultReserve){
                (metadata[j], metadata[k]) = (metadata[k], metadata[j]);
            }
        }
        return _toString(metadata[id]);
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        return bytes(baseURI).length != 0 && revealed ? string(
            abi.encodePacked(
                baseURI,
                metaId(tokenId),
                ".json"
            )) : preURI;
    }

    function availableReserve() public view returns (uint256) {
        return maxReserve - reserveMinted;
    }

    function availableForSale() external view returns (uint256) {
        return MAX_SUPPLY - _totalMinted();
    }

    function isWalletCappedByMode(address wallet, uint256 amount) public view returns (bool) {
        SalePhase phase = salePhase;
        if (phase == SalePhase.Private) return _getAux(wallet) + amount > maxPrivateWallet;
        // Public limit count include airdrop.
        if (phase == SalePhase.Public) return _numberMinted(wallet) - _getAux(wallet) + amount > maxPublicWallet;
        return false;
    }

}