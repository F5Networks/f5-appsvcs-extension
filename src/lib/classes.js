/**
 * Copyright 2024 F5, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

module.exports = {
    toMcp: {
        ALG_Log_Profile: 'ltm alg-log-profile',
        Data_Group: [
            'ltm data-group internal',
            'ltm data-group external'
        ],
        Firewall_Port_List: 'security firewall port-list',
        Firewall_Address_List: 'security firewall address-list',
        GSLB_Data_Center: 'gtm datacenter',
        GSLB_Server: 'gtm server',
        L4_Profile: 'ltm profile fastl4',
        Pool: 'ltm pool',
        Security_Log_Profile: 'security log profile',
        SSH_Proxy_Profile: 'security ssh profile',
        Service_Forwarding: 'ltm virtual',
        Service_Generic: 'ltm virtual',
        Service_HTTP: 'ltm virtual',
        Service_HTTPS: 'ltm virtual',
        Service_L4: 'ltm virtual',
        Service_SCTP: 'ltm virtual',
        Service_TCP: 'ltm virtual',
        Service_UDP: 'ltm virtual',
        SNAT_Pool: 'ltm snatpool',
        SNAT_Translation: 'ltm snat-translation',
        Multiplex_Profile: 'ltm profile one-connect',
        TCP_Profile: 'ltm profile tcp',
        TLS_Server: 'ltm profile client-ssl',
        TLS_Client: 'ltm profile server-ssl',
        HTML_Profile: 'ltm profile html',
        HTML_Rule: [
            'ltm html-rule comment-raise-event',
            'ltm html-rule comment-remove',
            'ltm html-rule tag-append-html',
            'ltm html-rule tag-prepend-html',
            'ltm html-rule tag-raise-event',
            'ltm html-rule tag-remove',
            'ltm html-rule tag-remove-attribute'
        ],
        Monitor: [
            'ltm monitor dns',
            'ltm monitor external',
            'ltm monitor ftp',
            'ltm monitor http',
            'ltm monitor https',
            'ltm monitor http2',
            'ltm monitor gateway-icmp',
            'ltm monitor inband',
            'ltm monitor ldap',
            'ltm monitor mysql',
            'ltm monitor postgresql',
            'ltm monitor radius',
            'ltm monitor sip',
            'ltm monitor smtp',
            'ltm monitor tcp-half-open',
            'ltm monitor tcp',
            'ltm monitor udp'
        ],
        FTP_Profile: 'ltm profile ftp',
        RTSP_Profile: 'ltm profile rtsp',
        SIP_Profile: 'ltm profile sip',
        SMTPS_Profile: 'ltm profile smtps',
        SOCKS_Profile: 'ltm profile socks',
        TFTP_Profile: 'ltm profile tftp',
        ILX_Profile: 'ltm profile ilx',
        UDP_Profile: 'ltm profile udp',
        Persist: [
            'ltm persistence cookie',
            'ltm persistence dest-addr',
            'ltm persistence hash',
            'ltm persistence msrdp',
            'ltm persistence sip',
            'ltm persistence source-addr',
            'ltm persistence ssl',
            'ltm persistence universal'
        ],
        Certificate: [
            'sys file ssl-cert',
            'sys file ssl-key'
        ],
        Certificate_Validator_OCSP: 'sys crypto cert-validator ocsp',
        CA_Bundle: 'sys file ssl-cert',
        WAF_Policy: 'asm policies',
        iRule: 'ltm rule',
        Endpoint_Policy: 'ltm policy',
        GSLB_Domain: [
            'gtm wideip a',
            'gtm wideip aaaa',
            'gtm wideip cname',
            'gtm wideip mx',
            'gtm wideip naptr'
        ],
        GSLB_iRule: 'gtm rule',
        GSLB_Topology_Region: [
            'gtm region'
        ],
        GSLB_Topology_Records: [
            'gtm topology',
            'gtm global-settings load-balancing'
        ],
        GSLB_Pool: [
            'gtm pool a',
            'gtm pool aaaa',
            'gtm pool cname',
            'gtm pool mx',
            'gtm pool naptr'
        ],
        GSLB_Prober_Pool: 'gtm prober-pool',
        GSLB_Monitor: [
            'gtm monitor http',
            'gtm monitor https',
            'gtm monitor gateway-icmp',
            'gtm monitor tcp-half-open',
            'gtm monitor tcp',
            'gtm monitor udp',
            'gtm monitor external'
        ],
        DOS_Profile: [
            'security dos profile',
            'security bot-defense profile'
        ],
        Service_Address: 'ltm virtual-address',
        Traffic_Log_Profile: 'ltm profile request-log',
        HTTP_Profile: 'ltm profile http',
        HTTP2_Profile: 'ltm profile http2',
        WebSocket_Profile: 'ltm profile websocket',
        Classification_Profile: 'ltm profile classification',
        Radius_Profile: 'ltm profile radius',
        IP_Other_Profile: 'ltm profile ipother',
        Analytics_Profile: 'ltm profile analytics',
        Analytics_TCP_Profile: 'ltm profile tcp-analytics',
        DNS_Cache: [
            'ltm dns cache transparent',
            'ltm dns cache resolver',
            'ltm dns cache validating-resolver'
        ],
        DNS_Logging_Profile: 'ltm profile dns-logging',
        DNS_Nameserver: 'ltm dns nameserver',
        DNS_Profile: 'ltm profile dns',
        DNS_Zone: 'ltm dns zone',
        Rewrite_Profile: 'ltm profile rewrite',
        HTTP_Acceleration_Profile: 'ltm profile web-acceleration',
        FIX_Profile: 'ltm profile fix',
        HTTP_Compress: 'ltm profile http-compression',
        Firewall_Rule_List: 'security firewall rule-list',
        Firewall_Policy: 'security firewall policy',
        DNS_TSIG_Key: 'ltm dns tsig-key',
        Endpoint_Strategy: 'ltm policy-strategy',
        Bandwidth_Control_Policy: 'net bwc policy',
        Enforcement_iRule: 'pem irule',
        Enforcement_Policy: 'pem policy',
        Enforcement_Diameter_Endpoint_Profile: 'pem profile diameter-endpoint',
        Enforcement_Radius_AAA_Profile: 'pem profile radius-aaa',
        Enforcement_Profile: 'pem profile spm',
        Enforcement_Subscriber_Management_Profile: 'pem profile subscriber-mgmt',
        Enforcement_Listener: 'pem listener',
        Enforcement_Interception_Endpoint: 'pem interception-endpoint',
        Enforcement_Format_Script: 'pem reporting format-script',
        Enforcement_Forwarding_Endpoint: 'pem forwarding-endpoint',
        Enforcement_Service_Chain_Endpoint: 'pem service-chain-endpoint',
        NAT_Policy: 'security nat policy',
        NAT_Source_Translation: 'security nat source-translation',
        Net_Address_List: 'net address-list',
        Net_Port_List: 'net port-list',
        Log_Publisher: 'sys log-config publisher',
        Log_Destination: [
            'sys log-config destination management-port',
            'sys log-config destination remote-high-speed-log',
            'sys log-config destination remote-syslog',
            'sys log-config destination splunk'
        ],
        Statistics_Profile: 'ltm profile statistics',
        Stream_Profile: 'ltm profile stream',
        Access_Profile: 'apm profile access',
        Per_Request_Access_Policy: 'apm policy access-policy',
        ICAP_Profile: 'ltm profile icap',
        Adapt_Profile: [
            'ltm profile request-adapt',
            'ltm profile response-adapt'
        ],
        Cipher_Rule: 'ltm cipher rule',
        Cipher_Group: 'ltm cipher group',
        Protocol_Inspection_Profile: 'security protocol-inspection profile',
        Idle_Timeout_Policy: 'net timer-policy',
        iFile: 'ltm ifile'
    }
};
