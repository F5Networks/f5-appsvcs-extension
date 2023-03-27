variable "location" {
  description = "The Azure Region in which the resources in this example should exist"
  default     = "westus2"
}

variable "publisher" {
  default = "f5-networks"
}

variable "offer" {
  default = "f5-big-ip-byol"
}

variable "sku" {
  default = "f5-big-all-2slot-byol"
}

variable "bigip_version" {
  description = "The BIG-IP version for the virtual machine"
  default     = "latest"
}

variable "instance_size" {
  description = "The instance size for the virtual machine"
  default     = "Standard_D4_v4"
}

variable "nic_count" {
  description = "Control whether or not 1nic resource should be used"
  default     = 1
}

variable "bigip_count" {
  description = "Number of BIGIPs to deploy"
  default = 1
}

variable "admin_username" {
  description = "The admin username for the virtual machine"
  default     = "azureuser"
}

variable "f5_cidr_blocks" {
  description = "The list of F5 IP addresses which are allowed to access the virtual machine"
  type    = list(string)
  default = []
}