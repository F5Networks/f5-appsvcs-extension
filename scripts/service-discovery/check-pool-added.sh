# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

#Get node info
BIGIP_IP_ADDRESS=$1
AS3_USERNAME=$2
AS3_PASSWORD=$3
AWS_TARGET_TAG_VALUE=$4
AWS_NODE_POOL=$(node scripts/service-discovery/get-instance-private-ip-address.js)
echo $AWS_NODE_POOL
echo $AWS_TARGET_TAG_VALUE
#Check the pool member
POOL_MEMBERS=$(curl -k -u $AS3_USERNAME:$AS3_PASSWORD -H "Content-Type: application/json" https://$BIGIP_IP_ADDRESS/mgmt/tm/ltm/pool/~TenantTestSD~Generic_Http_Node~web_pool_aws/members | grep $AWS_NODE_POOL)

#Check if we recieved the pool member or not
if [ "$AWS_TARGET_TAG_VALUE" == "awsNodeTagValue" ]; then
    if [ -z "$POOL_MEMBERS" ]; then
        echo -e "${RED}Failed Service Discovery${NC}"
        #Remove the tenant from the BIG IP
        REMOVE_TENANT=$(curl -sk -u $AS3_USERNAME:$AS3_PASSWORD https://$BIGIP_IP_ADDRESS/mgmt/shared/appsvcs/declare/TenantTestSD -H 'Content-Type: application/json' -X DELETE  -d '
        {
                        
        }' -k -H "Expect:")   
        exit 1 
    else
        echo "Passed Service Discovery" #Response contain pool member
        #Remove the tenant from the BIG IP
        REMOVE_TENANT=$(curl -sk -u $AS3_USERNAME:$AS3_PASSWORD https://$BIGIP_IP_ADDRESS/mgmt/shared/appsvcs/declare/TenantTestSD -H 'Content-Type: application/json' -X DELETE  -d '
        {
                        
        }' -k -H "Expect:")   
    fi
else
    if [ -z "$POOL_MEMBERS" ]; then
        echo "Passed Service Discovery"
        #Remove the tenant from the BIG IP
        REMOVE_TENANT=$(curl -sk -u $AS3_USERNAME:$AS3_PASSWORD https://$BIGIP_IP_ADDRESS/mgmt/shared/appsvcs/declare/TenantTestSD -H 'Content-Type: application/json' -X DELETE  -d '
        {
                        
        }' -k -H "Expect:")   
    else
        echo -e "${RED}Failed Service Discovery${NC}" #Response contain pool member
        #Remove the tenant from the BIG IP
        REMOVE_TENANT=$(curl -sk -u $AS3_USERNAME:$AS3_PASSWORD https://$BIGIP_IP_ADDRESS/mgmt/shared/appsvcs/declare/TenantTestSD -H 'Content-Type: application/json' -X DELETE  -d '
        {
                        
        }' -k -H "Expect:")   
        exit 1 
    fi
fi
  