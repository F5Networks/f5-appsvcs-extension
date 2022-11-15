set -e

CI_COMMIT_REF_NAME="${CI_COMMIT_REF_NAME:-develop}"
IMAGE_NAME="${IMAGE_NAME:-f5-as3-container}"

TARGET=$(ls -v dist/*appsvcs-3*.rpm 2>/dev/null|tail -1)
IMAGE_TAG=$(rpm -qp --queryformat '%{VERSION}-%{RELEASE}' $TARGET)

if [[ ${CI_COMMIT_REF_NAME} == 'master' ]]; then
  IMAGE_TAG=$(echo $IMAGE_TAG | grep -o "^[^-]\+")
fi

docker build -f Dockerfile -t $IMAGE_NAME:$IMAGE_TAG --build-arg TARGET=$TARGET .
docker save $IMAGE_NAME:$IMAGE_TAG | gzip -c > dist/$IMAGE_NAME-$IMAGE_TAG.tar.gz

# Grubtainer does not build - AUTOTOOL-1472 to fix
# docker build -f Dockerfile.icontrol-gateway -t $IMAGE_NAME-fig:$IMAGE_TAG --build-arg TARGET=$TARGET .
# exit_if_bad_rc $?
# docker save $IMAGE_NAME-fig:$IMAGE_TAG | gzip -c > dist/$IMAGE_NAME-fig-$IMAGE_TAG.tar.gz
# exit_if_bad_rc $?
