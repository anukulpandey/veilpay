// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

/**
 * @title PayrollManager
 * @notice On-chain org/roster/run registry for VeilPay confidential payroll.
 * @dev Salaries never touch this contract. Amounts exist only as eERC
 *      ciphertexts; payments are eERC private transfers carrying encrypted
 *      payslip metadata. This contract records who works where and when a
 *      payroll run happened - the public facts an org is happy to reveal.
 */
contract PayrollManager {
    struct Employee {
        address wallet;
        string label; // employer-chosen display name / role tag
        bool active;
    }

    struct PayrollRun {
        uint64 timestamp;
        uint32 paidCount;
        string memo; // e.g. "2026-07 salaries"
    }

    struct Org {
        string name;
        address employer;
    }

    Org[] private _orgs;
    mapping(uint256 orgId => Employee[]) private _employees;
    mapping(uint256 orgId => PayrollRun[]) private _runs;
    mapping(uint256 orgId => mapping(address wallet => bool)) public isEmployee;
    mapping(address employer => uint256[]) private _orgsByEmployer;
    mapping(address wallet => uint256[]) private _orgsByEmployee;

    event OrgCreated(uint256 indexed orgId, address indexed employer, string name);
    event EmployeeAdded(uint256 indexed orgId, address indexed wallet, string label);
    event EmployeeStatusChanged(uint256 indexed orgId, address indexed wallet, bool active);
    event PayrollRunLogged(uint256 indexed orgId, uint256 indexed runId, uint32 paidCount, string memo);

    error NotEmployer();
    error AlreadyEmployee();
    error UnknownEmployee();

    modifier onlyEmployer(uint256 orgId) {
        if (_orgs[orgId].employer != msg.sender) revert NotEmployer();
        _;
    }

    function createOrg(string calldata name) external returns (uint256 orgId) {
        orgId = _orgs.length;
        _orgs.push(Org({name: name, employer: msg.sender}));
        _orgsByEmployer[msg.sender].push(orgId);
        emit OrgCreated(orgId, msg.sender, name);
    }

    function addEmployee(
        uint256 orgId,
        address wallet,
        string calldata label
    ) external onlyEmployer(orgId) {
        if (isEmployee[orgId][wallet]) revert AlreadyEmployee();
        isEmployee[orgId][wallet] = true;
        _employees[orgId].push(Employee({wallet: wallet, label: label, active: true}));
        _orgsByEmployee[wallet].push(orgId);
        emit EmployeeAdded(orgId, wallet, label);
    }

    function setEmployeeActive(
        uint256 orgId,
        address wallet,
        bool active
    ) external onlyEmployer(orgId) {
        Employee[] storage list = _employees[orgId];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].wallet == wallet) {
                list[i].active = active;
                emit EmployeeStatusChanged(orgId, wallet, active);
                return;
            }
        }
        revert UnknownEmployee();
    }

    /// @notice Employer logs a completed payroll run (the eERC transfers
    ///         themselves happen directly on the EncryptedERC contract).
    function logPayrollRun(
        uint256 orgId,
        uint32 paidCount,
        string calldata memo
    ) external onlyEmployer(orgId) returns (uint256 runId) {
        runId = _runs[orgId].length;
        _runs[orgId].push(
            PayrollRun({timestamp: uint64(block.timestamp), paidCount: paidCount, memo: memo})
        );
        emit PayrollRunLogged(orgId, runId, paidCount, memo);
    }

    // ---- views ----

    function orgCount() external view returns (uint256) {
        return _orgs.length;
    }

    function getOrg(uint256 orgId) external view returns (Org memory) {
        return _orgs[orgId];
    }

    function employeesOf(uint256 orgId) external view returns (Employee[] memory) {
        return _employees[orgId];
    }

    function runsOf(uint256 orgId) external view returns (PayrollRun[] memory) {
        return _runs[orgId];
    }

    function orgsOfEmployer(address employer) external view returns (uint256[] memory) {
        return _orgsByEmployer[employer];
    }

    function orgsOfEmployee(address wallet) external view returns (uint256[] memory) {
        return _orgsByEmployee[wallet];
    }
}
