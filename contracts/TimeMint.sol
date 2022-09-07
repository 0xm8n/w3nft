// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

contract TimeMint is Ownable {

    error InvalidValue(string variable, uint256 value);

    enum SaleState {
        NotStarted,
        PrivateOn,
        PublicOn,
        SoldOut,
        Close,
        Paused
    }

    enum SalePhase {
        None,
        Private,
        Public
    }

    struct SaleConfig {
        uint256 beginTime;
        uint256 endTime;
    }

    SaleState internal saleState = SaleState.NotStarted;
    SalePhase public salePhase = SalePhase.None;
    SaleConfig public privateSale;
    SaleConfig public publicSale;

    bool public privateDA;
    bool public publicDA;

    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public constant MAX_PRIVATE = 6800;
    uint256 public constant VAULT_RESERVE = 2;
    uint256 internal maxPrivateWallet = 3;
    uint256 internal maxPublicWallet = 3;
    uint256 internal maxPrivateTx = 3;
    uint256 internal maxPublicTx = 3;
    uint256 public privatePrice = 100000000000000000; // 0.10
    uint256 public endPrice = 150000000000000000; // 0.15 DA or Public
    uint256 public startPrice = 1000000000000000000; // 1.00
    uint256 public reducePrice = 50000000000000000; // 0.05
    uint256 public reduceTime = 20; // 20 min

    uint256 public reserveMinted;
    uint256 public maxReserve = 200;

    function enablePrivate(uint256 _beginTime, uint256 _minLong) external onlyOwner {
        if(_beginTime <= block.timestamp) revert InvalidValue("_beginTime", _beginTime);
        if(_minLong == 0) revert InvalidValue("_minLong", _minLong);
        salePhase = SalePhase.Private;
        privateSale = SaleConfig(_beginTime, _beginTime + (_minLong*60));
    }

    function enablePublic(uint256 _beginTime, uint256 _minLong) external onlyOwner {
        if(_beginTime <= block.timestamp) revert InvalidValue("_beginTime", _beginTime);
        if(_minLong == 0) revert InvalidValue("_minLong", _minLong);
        salePhase = SalePhase.Public;
        publicSale = SaleConfig(_beginTime, _beginTime + (_minLong*60));
    }

    function togglePrivateDA() external onlyOwner {
        privateDA = !privateDA;
    }

    function togglePublicDA() external onlyOwner {
        publicDA = !publicDA;
    }

    function setTransactionLimit(
        uint256 maxTxPrivate, uint256 maxTxPublic, 
        uint256 maxPrivate, uint256 maxPublic
    )
        external onlyOwner
    {
        maxPrivateTx = maxTxPrivate;
        maxPublicTx = maxTxPublic;
        maxPrivateWallet = maxPrivate;
        maxPublicWallet = maxPublic;
    }

    function setPrivatePrice(uint256 _privatePrice) external onlyOwner {
        privatePrice = _privatePrice;
    }

    function setDAParams(uint256 _startPrice, uint256 _endPrice, uint256 _reducePrice) 
        external onlyOwner
    {
        if(_reducePrice >= _startPrice) revert InvalidValue("_reducePrice", _reducePrice);
        if(_endPrice >= _startPrice) revert InvalidValue("_endPrice", _endPrice);
        endPrice = _endPrice;
        reducePrice = _reducePrice;
        startPrice = _startPrice;
    }

    function setReduceTime(uint256 minute) external onlyOwner {
        if(minute == 0) revert InvalidValue("minute", minute);
        reduceTime = minute;
    }
    
    function setReserve(uint256 reserve) external onlyOwner {
        maxReserve = reserve;
    }
    
    function setCloseSale() external onlyOwner {
        saleState = SaleState.Close;
    }

    function setPauseSale() external onlyOwner {
        saleState = SaleState.Paused;
    }

    function resetSaleState() external onlyOwner {
        saleState = SaleState.NotStarted;
    }

    function priceByMode() public view returns (uint256) {
        SalePhase phase = salePhase;
        uint256 blockTime = block.timestamp;
        uint256 passedTime = 0;
        if (phase == SalePhase.Private) {
            if (!privateDA) return privatePrice;
            uint256 beginTime = privateSale.beginTime;
            if (beginTime > 0 && blockTime >= beginTime) {
                passedTime = blockTime - privateSale.beginTime;
            }
        }
        if (phase == SalePhase.Public) {
            if (!publicDA) return endPrice;
            uint256 beginTime = publicSale.beginTime;
            if (beginTime > 0 && blockTime >= beginTime) {
                passedTime = blockTime - publicSale.beginTime;
            }
        }
        uint256 discountPrice = (passedTime/(reduceTime*60)) * reducePrice;
        if (startPrice - endPrice < discountPrice) return endPrice;
        return startPrice - discountPrice;
    }
}