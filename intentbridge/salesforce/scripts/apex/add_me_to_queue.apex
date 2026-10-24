// Adds the running user to the IB Supervisor queue (run separately from seed.apex to avoid mixed DML).
Group q = [SELECT Id FROM Group WHERE Type = 'Queue' AND DeveloperName = 'IB_Supervisor' LIMIT 1];
if ([SELECT COUNT() FROM GroupMember WHERE GroupId = :q.Id AND UserOrGroupId = :UserInfo.getUserId()] == 0) {
    insert new GroupMember(GroupId = q.Id, UserOrGroupId = UserInfo.getUserId());
}
System.debug('IB Supervisor queue membership ok for ' + UserInfo.getUserName());
