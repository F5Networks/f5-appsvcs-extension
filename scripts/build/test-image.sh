docker run --name image_test --rm -d -p 9443:443 $1 1>/dev/null
sleep 10
curl --insecure --fail --show-error https://localhost:9443/mgmt/shared/appsvcs/info
RESULT=$?
docker stop image_test 1>/dev/null
exit $RESULT
