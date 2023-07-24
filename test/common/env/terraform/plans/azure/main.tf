terraform {
  backend "http" {
  }
}

module "provider" {
    source = "../../modules/providers/azure"
}

provider "azurerm" {
  features {}
}

module "utils" {
  source = "../../modules/utils"
}

data "azurerm_subscription" "primary" {}

data "template_file" "custom_data" {
  template = file("../../onboard.yaml")
  vars = {
    AS3_PASSWORD = module.utils.admin_password
  }
}

resource "azurerm_role_definition" "azurerm_role_def" {
  name        = module.utils.env_prefix
  scope       = data.azurerm_subscription.primary.id
  description = "Manage VM actions, network, read storage, block role assignments/policy assignments."

  permissions {
    actions = [
      "Microsoft.Authorization/*/read",
      "Microsoft.Compute/locations/*/read",
      "Microsoft.Compute/virtualMachines/*/read",
      "Microsoft.Network/networkInterfaces/*/read",
      "Microsoft.Network/networkInterfaces/*/write",
      "Microsoft.Network/publicIPAddresses/*/read",
      "Microsoft.Network/publicIPAddresses/*/write",
      "Microsoft.Network/*/join/action",
      "Microsoft.Resources/subscriptions/resourceGroups/read",
      "Microsoft.Storage/storageAccounts/read",
      "Microsoft.Storage/storageAccounts/listKeys/action"
    ]
    not_actions = [
      "Microsoft.Authorization/*/Delete",
      "Microsoft.Authorization/*/Write"
    ]
    data_actions = []
    not_data_actions = []
  }

  assignable_scopes = [
    data.azurerm_subscription.primary.id
  ]
}

resource "azurerm_role_assignment" "vm_assignment" {
  count                 = var.bigip_count
  depends_on            = [azurerm_role_definition.azurerm_role_def]
  scope                 = data.azurerm_subscription.primary.id
  role_definition_id    = azurerm_role_definition.azurerm_role_def.role_definition_resource_id
  principal_id          = lookup(azurerm_virtual_machine.vm[count.index].identity[0], "principal_id")
}

resource "azurerm_virtual_machine" "vm" {
  count                        = var.bigip_count
  # We need to create list of interfaces here. depends_on accepts only calculated list of values
  # we cannot use ternary operator here like we do for network_interface_ids,
  # so locals section below will do the trick.
  depends_on                   = [ local.interface_list ]
  name                         = "as3-bigip-${module.utils.env_prefix}-${count.index}"
  location                     = var.location
  resource_group_name          = module.utils.env_prefix
  primary_network_interface_id = azurerm_network_interface.mgmt[count.index].id
  vm_size                      = var.instance_size
  network_interface_ids        = var.nic_count == 1 ? [ azurerm_network_interface.mgmt[count.index].id ] : [ azurerm_network_interface.mgmt[count.index].id, azurerm_network_interface.external[count.index].id ]

  # This means the OS Disk will be deleted when Terraform destroys the Virtual Machine
  # NOTE: This may not be optimal in all cases.
  delete_os_disk_on_termination = true

  # This means the Data Disk Disk will be deleted when Terraform destroys the Virtual Machine
  # NOTE: This may not be optimal in all cases.
  delete_data_disks_on_termination = true

  storage_image_reference {
    publisher = var.publisher
    offer     = var.offer
    sku       = var.sku
    version   = var.bigip_version
  }

  plan {
    publisher = var.publisher
    product   = var.offer
    name      = var.sku
  }

  storage_os_disk {
    name              = "osdisk-${module.utils.env_prefix}-${count.index}"
    caching           = "ReadWrite"
    create_option     = "FromImage"
    managed_disk_type = "Standard_LRS"
  }

  os_profile {
    computer_name  = "f5vm-${module.utils.env_prefix}-${count.index}"
    admin_username = var.admin_username
    admin_password = module.utils.admin_password
    custom_data    = "${data.template_file.custom_data.rendered}"
  }

  os_profile_linux_config {
    disable_password_authentication = false
  }

  identity {
    type = "SystemAssigned"
  }

  timeouts {
    create = "1h"
    delete = "1h"
  }
}

# TODO: Make this logic smarter to handle 2 NICs case.
locals {
  interface_list = var.nic_count == 1 ? [ azurerm_network_interface.mgmt[*].id ] : [ azurerm_network_interface.mgmt[*].id, azurerm_network_interface.internal[*].id, azurerm_network_interface.external[*].id ]
}
