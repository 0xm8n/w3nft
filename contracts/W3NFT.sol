// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "erc721a/contracts/extensions/ERC721AQueryable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "./TimeMint.sol";
import "./lib/EIP712Signed.sol";

contract W3NFT is
    ERC721AQueryable,
    VRFConsumerBaseV2,
    EIP712Signed,
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
    bool public constant qBaseMint = false;

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

    function mintToken(uint256 amount, bytes calldata signature)
        external payable
    {
        require(!msg.sender.isContract(), "Contract is not allowed");
        SaleState _saleState = getState();
        require( _saleState == SaleState.PrivateOn || _saleState == SaleState.PublicOn, "Sale not available");
        unchecked {
            require(isTxValid(msg.sender, amount), "Exceed limit");
            require(msg.value >= amount * priceByMode(), "Insufficient funds");

            if (_saleState == SaleState.PrivateOn) {
                require(isEIP712Signed(signature), "Not whitelisted");
                _setAux(msg.sender, uint64(_getAux(msg.sender) + amount));
            }
            if (_saleState == SaleState.PublicOn && qBaseMint) require(isEIP712Signed(signature), "Not queued");
        }
        _mint(msg.sender, amount);
    }
    
    function airdrop(address[] memory addresses, uint256 amount) external onlyOwner {
        unchecked {
            uint256 totalAirdrop = addresses.length * amount;
            require(
                reserveMinted + totalAirdrop <= maxReserve,
                "Insufficient reserve"
            );
            require(
                _totalMinted() + totalAirdrop <= MAX_SUPPLY,
                "Exceed max supply"
            );
            reserveMinted += totalAirdrop;
        }
        for (uint256 i = 0; i < addresses.length; ++i) {
            _mint(addresses[i], amount);
        }
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
    
    function isTxValid(address wallet, uint256 amount) public view returns (bool) {
        if(salePhase == SalePhase.Private){
            if(amount > maxPrivateTx) return false;
            if(_getAux(wallet) + amount > maxPrivateWallet) return false;
            if(_totalMinted() - reserveMinted + amount > MAX_PRIVATE) return false;
        }
        if(salePhase == SalePhase.Public){
            if(amount > maxPublicTx) return false;
            if(_numberMinted(wallet) - _getAux(wallet) + amount > maxPublicWallet) return false;
            if(_totalMinted() - reserveMinted + maxReserve + amount > MAX_SUPPLY) return false;
        }
        return true;
    }

    function isSoldOut() public view returns (bool) {
        SalePhase phase = salePhase;
        if (phase == SalePhase.Private) return _totalMinted() - reserveMinted >= MAX_PRIVATE;
        if (phase == SalePhase.Public) return _totalMinted() - reserveMinted + maxReserve >= MAX_SUPPLY;
        return false;
    }

    function getState() public view returns (SaleState) {
        SalePhase phase = salePhase;
        SaleState state = saleState;
        if ( state == SaleState.Close ) return SaleState.Close;
        if ( state == SaleState.Paused ) return SaleState.Paused;
        if ( isSoldOut() ) return SaleState.SoldOut;
        uint256 blockTime = block.timestamp;
        if ( phase == SalePhase.Private ) {
            uint256 endTime = privateSale.endTime;
            if ( endTime > 0 && blockTime > endTime ) return SaleState.Close;
            uint256 beginTime = privateSale.beginTime;
            if ( beginTime > 0 && blockTime >= beginTime ) return SaleState.PrivateOn;
        }
        if ( phase == SalePhase.Public ) {
            uint256 endTime = publicSale.endTime;
            if ( endTime > 0 && blockTime > endTime ) return SaleState.Close;
            uint256 beginTime = publicSale.beginTime;
            if ( beginTime > 0 && blockTime >= beginTime ) return SaleState.PublicOn;
        }
        return SaleState.NotStarted;
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
        for (uint256 i = 1; i <= maxSupply ; ++i) {
            metadata[i] = i;
        }
        for (uint256 j = vaultReserve+1; j <= maxSupply ; ++j) {
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

    function numberMinted(address wallet) public view returns (uint256) {
        return _numberMinted(wallet);
    }

    function privateMinted(address wallet) public view returns (uint256) {
        return _getAux(wallet);
    }
}