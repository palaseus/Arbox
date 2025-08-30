// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockTarget
 * @notice Mock target contract for testing TimeLock and AuditTrail functionality
 */
contract MockTarget {
    
    // State variables for testing
    uint256 public testValue;
    string public testString;
    bool public testBool;
    
    // Events
    event TestFunctionCalled(address indexed caller, uint256 value);
    event ValueUpdated(uint256 oldValue, uint256 newValue);
    event StringUpdated(string oldString, string newString);
    event BoolUpdated(bool oldBool, bool newBool);
    
    /**
     * @notice Test function for TimeLock execution
     * @return Test string
     */
    function testFunction() external pure returns (string memory) {
        return "test";
    }
    
    /**
     * @notice Function that updates a value
     * @param newValue New value to set
     */
    function updateValue(uint256 newValue) external {
        uint256 oldValue = testValue;
        testValue = newValue;
        emit ValueUpdated(oldValue, newValue);
    }
    
    /**
     * @notice Function that updates a string
     * @param newString New string to set
     */
    function updateString(string calldata newString) external {
        string memory oldString = testString;
        testString = newString;
        emit StringUpdated(oldString, newString);
    }
    
    /**
     * @notice Function that updates a boolean
     * @param newBool New boolean to set
     */
    function updateBool(bool newBool) external {
        bool oldBool = testBool;
        testBool = newBool;
        emit BoolUpdated(oldBool, newBool);
    }
    
    /**
     * @notice Function that requires ETH
     */
    function receiveETH() external payable {
        emit TestFunctionCalled(msg.sender, msg.value);
    }
    
    /**
     * @notice Function that reverts for testing
     */
    function revertFunction() external pure {
        revert("Test revert");
    }
    
    /**
     * @notice Function that returns multiple values
     * @return value1 First value
     * @return value2 Second value
     * @return value3 Third value
     */
    function getMultipleValues() external view returns (uint256 value1, string memory value2, bool value3) {
        return (testValue, testString, testBool);
    }
    
    /**
     * @notice Function that takes complex parameters
     * @param values Array of values
     * @param strings Array of strings
     * @param bools Array of booleans
     */
    function complexFunction(
        uint256[] calldata values,
        string[] calldata strings,
        bool[] calldata bools
    ) external {
        require(values.length == strings.length && strings.length == bools.length, "Arrays must have same length");
        
        for (uint256 i = 0; i < values.length; i++) {
            testValue = values[i];
            testString = strings[i];
            testBool = bools[i];
        }
    }
}
