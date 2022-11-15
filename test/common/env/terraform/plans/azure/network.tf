# TODO: Create networks based on demand. Right now we're creating
# all 3 NICs even deployment is for 1 NIC instance.
resource "azurerm_resource_group" "deployment" {
  name      = module.utils.env_prefix
  location  = var.location
  tags = {
    creator = "Terraform"
    project = "AS3"
  }
}

resource "azurerm_virtual_network" "deployment" {
  name                = "${module.utils.env_prefix}-network"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.deployment.location
  resource_group_name = azurerm_resource_group.deployment.name
}

resource "azurerm_subnet" "mgmt" {
  name                 = "mgmt"
  resource_group_name  = azurerm_resource_group.deployment.name
  virtual_network_name = azurerm_virtual_network.deployment.name
  address_prefixes     = ["10.0.0.0/24"]
  depends_on = [azurerm_network_security_group.deployment]
}

resource "azurerm_subnet" "internal" {
  name                 = "internal"
  resource_group_name  = azurerm_resource_group.deployment.name
  virtual_network_name = azurerm_virtual_network.deployment.name
  address_prefixes     = ["10.0.1.0/24"]
  depends_on = [azurerm_network_security_group.deployment]
}

resource "azurerm_subnet" "external" {
  name                 = "external"
  resource_group_name  = azurerm_resource_group.deployment.name
  virtual_network_name = azurerm_virtual_network.deployment.name
  address_prefixes     = ["10.0.2.0/24"]
  depends_on = [azurerm_network_security_group.deployment]
}

resource "azurerm_public_ip" "pip0" {
  name                  = "${module.utils.env_prefix}-mgmt-pip0"
  location              = var.location
  resource_group_name   = module.utils.env_prefix
  allocation_method     = "Static"
  depends_on = [azurerm_resource_group.deployment]
}

resource "azurerm_network_security_group" "deployment" {
  name                         = "${module.utils.env_prefix}-sg"
  location                     = var.location
  resource_group_name          = azurerm_resource_group.deployment.name
  security_rule {
    name                       = "allow_all_from_f5"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefixes    = var.f5_cidr_blocks
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_interface" "mgmt0" {
  name                            = "${module.utils.env_prefix}-mgmt0"
  location                        = var.location
  resource_group_name             = azurerm_resource_group.deployment.name
  ip_configuration {
    name                          = "${module.utils.env_prefix}-mgmt0"
    subnet_id                     = azurerm_subnet.mgmt.id
    private_ip_address_allocation = "Static"
    private_ip_address            = "10.0.0.4"
    public_ip_address_id          = azurerm_public_ip.pip0.id
  }

  depends_on = [azurerm_network_security_group.deployment]
}

resource "azurerm_network_interface_security_group_association" "mgmt0" {
  network_interface_id      = azurerm_network_interface.mgmt0.id
  network_security_group_id = azurerm_network_security_group.deployment.id
  depends_on = [azurerm_network_interface.mgmt0]
}

resource "azurerm_network_interface" "internal0" {
  name                            = "${module.utils.env_prefix}-int0"
  location                        = var.location
  resource_group_name             = azurerm_resource_group.deployment.name
  ip_configuration {
    name                          = "${module.utils.env_prefix}-int0"
    subnet_id                     = azurerm_subnet.internal.id
    private_ip_address_allocation = "Static"
    private_ip_address            = "10.0.1.4"
  }

  depends_on = [azurerm_network_security_group.deployment]
}

resource "azurerm_network_interface_security_group_association" "internal0" {
  network_interface_id      = azurerm_network_interface.internal0.id
  network_security_group_id = azurerm_network_security_group.deployment.id
  depends_on = [azurerm_network_interface.internal0]
}

resource "azurerm_network_interface" "external0" {
  name                            = "${module.utils.env_prefix}-ext0"
  location                        = var.location
  resource_group_name             = azurerm_resource_group.deployment.name
  ip_configuration {
    name                          = "${module.utils.env_prefix}-ext0"
    subnet_id                     = azurerm_subnet.external.id
    private_ip_address_allocation = "Static"
    private_ip_address            = "10.0.2.4"
    primary                       = true
  }

  depends_on = [azurerm_network_security_group.deployment]
}

resource "azurerm_network_interface_security_group_association" "external0" {
  network_interface_id      = azurerm_network_interface.external0.id
  network_security_group_id = azurerm_network_security_group.deployment.id
  depends_on = [azurerm_network_interface.external0]
}
