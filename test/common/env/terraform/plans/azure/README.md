# Deploy for openstack(VIO) using terraform.

## Requirements

- You'll need a terraform binary or use docker container.
- Setup environment variables needed for your project:

        export ARM_CLIENT_ID=<arm clien id>
        export ARM_TENANT_ID=<arm tenant id>
        export ARM_CLIENT_SECRET=<arm secret>
        export ARM_SUBSCRIPTION_ID=<arm subscription id>
        export TEST_RESOURCES_URL_AZURE=<azure resource url>
        export REGKEY=<license key>
        export F5_CIDR_BLOCKS=<f5 IPs list>
        export TF_HTTP_ADDRESS=<your gitlab domain>/api/v4/projects/<project id>/terraform/state/azure-<BIGIP major version>

## Manual deployment

- Change dir to test/integration/env/terraform/azure.
- Run `terraform init` output should be like:

        Initializing the backend...

        Initializing provider plugins...
        - Finding latest version of hashicorp/template...
        - Finding latest version of hashicorp/random...
        - Finding hashicorp/azurerm versions matching "~> 2.29"...
        - Installing hashicorp/template v2.2.0...
        - Installed hashicorp/template v2.2.0 (signed by HashiCorp)
        - Installing hashicorp/random v3.1.0...
        - Installed hashicorp/random v3.1.0 (signed by HashiCorp)
        - Installing hashicorp/azurerm v2.75.0...
        - Installed hashicorp/azurerm v2.75.0 (signed by HashiCorp)

        Terraform has been successfully initialized!

**NOTE:** You'll need to generate access tokey to have access to Gitlab's terraform state files:
        Go to `Settings` -> `Access Tokens` and generate api token:

        export TF_HTTP_USERNAME=<your olymus username>
        export TF_HTTP_PASSWORD=<token>

To deploy instance(s) without reporting to Gitlab's state, go and edit `main.tf` file and comment this two lines:
          backend "http" {
          }

- After initialization successfull, run `apply`:

        terraform apply -var bigip_image="$BIGIP_IMAGE" -auto-approve

- After deployment successfull you'll get output like:

        Outputs:
        admin_ip = [
          "BIGIP_IP",
        ]
        admin_username = "admin"
        admin_password = "password"

- To get outputs into environment variable run this:

        export BIGIPS_ADDRESSES=$(terraform output --json admin_ip | jq -rc .[])

- To teardown instance(s) run `terraform destroy -auto-approve` cmd:

        Destroy complete! Resources: 18 destroyed.

# Resource Access
+ To access the VMs, check the output or artifact from the 'deploy' job. This has IP, username, and password information.
+ Test VMs have source IPs restricted to F5 IP blocks. This list is in a CI/CD variable (F5_CIDR_BLOCKS). If you can't ssh in, check that list against your IP.

# Resource clean up
Test resources are cleaned up automatically before each nightly run and instances state is controlled by `terraform state` service. States can be found at `Operations/terraform` section in gitlab.
