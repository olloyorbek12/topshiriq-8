// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LogisticsChain {
    address public owner;
    mapping(address => bool) public operators;

    enum DeliveryStatus {
        Created,
        InWarehouse,
        InTransit,
        AtCustoms,
        Delivered,
        Cancelled
    }

    struct Product {
        bytes32 id;
        string serialNumber;
        string name;
        string category;
        string metadataCID;
        string origin;
        address currentOwner;
        address manufacturer;
        DeliveryStatus status;
        string currentLocation;
        uint256 createdAt;
        uint256 updatedAt;
        bool exists;
        bool authentic;
    }

    struct SupplyEvent {
        bytes32 productId;
        address actor;
        address fromOwner;
        address toOwner;
        DeliveryStatus status;
        string location;
        string note;
        uint256 timestamp;
    }

    mapping(bytes32 => Product) private products;
    mapping(bytes32 => SupplyEvent[]) private histories;
    bytes32[] private productIds;
    uint256 public eventCount;

    event OperatorUpdated(address indexed operator, bool active);
    event ProductRegistered(bytes32 indexed productId, string serialNumber, address indexed owner);
    event StatusUpdated(bytes32 indexed productId, DeliveryStatus status, string location, string note);
    event OwnershipTransferred(bytes32 indexed productId, address indexed fromOwner, address indexed toOwner);
    event AuthenticityUpdated(bytes32 indexed productId, bool authentic);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner, "Only operator");
        _;
    }

    modifier productExists(bytes32 productId) {
        require(products[productId].exists, "Product not found");
        _;
    }

    constructor() {
        owner = msg.sender;
        operators[msg.sender] = true;
        emit OperatorUpdated(msg.sender, true);
    }

    function setOperator(address operator, bool active) external onlyOwner {
        require(operator != address(0), "Zero address");
        operators[operator] = active;
        emit OperatorUpdated(operator, active);
    }

    function registerProduct(
        bytes32 productId,
        string calldata serialNumber,
        string calldata name,
        string calldata category,
        string calldata metadataCID,
        string calldata origin,
        address initialOwner,
        string calldata initialLocation
    ) external onlyOperator {
        require(productId != bytes32(0), "Empty product id");
        require(!products[productId].exists, "Product exists");
        require(initialOwner != address(0), "Zero owner");

        products[productId] = Product({
            id: productId,
            serialNumber: serialNumber,
            name: name,
            category: category,
            metadataCID: metadataCID,
            origin: origin,
            currentOwner: initialOwner,
            manufacturer: msg.sender,
            status: DeliveryStatus.Created,
            currentLocation: initialLocation,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            exists: true,
            authentic: true
        });
        productIds.push(productId);

        _appendEvent(
            productId,
            address(0),
            initialOwner,
            DeliveryStatus.Created,
            initialLocation,
            "Product registered"
        );

        emit ProductRegistered(productId, serialNumber, initialOwner);
    }

    function updateStatus(
        bytes32 productId,
        DeliveryStatus status,
        string calldata location,
        string calldata note
    ) external onlyOperator productExists(productId) {
        Product storage product = products[productId];
        product.status = status;
        product.currentLocation = location;
        product.updatedAt = block.timestamp;

        _appendEvent(productId, product.currentOwner, product.currentOwner, status, location, note);
        emit StatusUpdated(productId, status, location, note);
    }

    function transferOwnership(
        bytes32 productId,
        address newOwner,
        string calldata location,
        string calldata note
    ) external onlyOperator productExists(productId) {
        require(newOwner != address(0), "Zero owner");
        Product storage product = products[productId];
        address previousOwner = product.currentOwner;
        product.currentOwner = newOwner;
        product.currentLocation = location;
        product.updatedAt = block.timestamp;

        _appendEvent(productId, previousOwner, newOwner, product.status, location, note);
        emit OwnershipTransferred(productId, previousOwner, newOwner);
    }

    function setAuthenticity(bytes32 productId, bool authentic, string calldata note)
        external
        onlyOperator
        productExists(productId)
    {
        Product storage product = products[productId];
        product.authentic = authentic;
        product.updatedAt = block.timestamp;

        _appendEvent(
            productId,
            product.currentOwner,
            product.currentOwner,
            product.status,
            product.currentLocation,
            note
        );
        emit AuthenticityUpdated(productId, authentic);
    }

    function verifyProduct(bytes32 productId)
        external
        view
        returns (
            bool valid,
            bool authentic,
            address currentOwner,
            DeliveryStatus status,
            string memory currentLocation,
            uint256 historyLength
        )
    {
        Product storage product = products[productId];
        valid = product.exists && product.authentic && product.status != DeliveryStatus.Cancelled;
        return (
            valid,
            product.authentic,
            product.currentOwner,
            product.status,
            product.currentLocation,
            histories[productId].length
        );
    }

    function getProduct(bytes32 productId) external view productExists(productId) returns (Product memory) {
        return products[productId];
    }

    function getHistoryLength(bytes32 productId) external view productExists(productId) returns (uint256) {
        return histories[productId].length;
    }

    function getHistoryEvent(bytes32 productId, uint256 index)
        external
        view
        productExists(productId)
        returns (SupplyEvent memory)
    {
        require(index < histories[productId].length, "Index out of range");
        return histories[productId][index];
    }

    function getProductCount() external view returns (uint256) {
        return productIds.length;
    }

    function getProductIdAt(uint256 index) external view returns (bytes32) {
        require(index < productIds.length, "Index out of range");
        return productIds[index];
    }

    function _appendEvent(
        bytes32 productId,
        address fromOwner,
        address toOwner,
        DeliveryStatus status,
        string memory location,
        string memory note
    ) private {
        histories[productId].push(
            SupplyEvent({
                productId: productId,
                actor: msg.sender,
                fromOwner: fromOwner,
                toOwner: toOwner,
                status: status,
                location: location,
                note: note,
                timestamp: block.timestamp
            })
        );
        eventCount += 1;
    }
}
