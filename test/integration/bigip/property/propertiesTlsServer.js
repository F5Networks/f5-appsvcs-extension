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

const {
    assertClass,
    getBigIpVersion,
    getItemName,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');
const requestUtil = require('../../../common/requestUtilPromise');

const PATH_PREFIX = '/TEST_TLS_Server/Application/';
const extractFunctions = {
    certs(result) {
        const profiles = result.filter((c) => c.partition === 'TEST_TLS_Server');
        return profiles.map((p) => {
            const profile = {
                name: p.name,
                cert: p.cert.replace(PATH_PREFIX, ''),
                key: p.key.replace(PATH_PREFIX, ''),
                mode: p.mode,
                serverName: p.serverName || 'none',
                sniDefault: p.sniDefault
            };
            if (p.certKeyChain) {
                profile.certKeyChain = p.certKeyChain.map((ckc) => ({
                    name: ckc.name,
                    cert: ckc.cert.replace(PATH_PREFIX, ''),
                    key: ckc.key.replace(PATH_PREFIX, ''),
                    chain: (ckc.chain) ? ckc.chain.replace(PATH_PREFIX, '') : 'none',
                    usage: util.versionLessThan(getBigIpVersion(), '14.0') ? 'SERVER' : ckc.usage
                }));
            }
            // normalize ssl forward proxy to match 14.0+
            if (util.versionLessThan(getBigIpVersion(), '14.0') && p.proxyCaCert && p.proxyCaCert !== 'none') {
                profile.certKeyChain = profile.certKeyChain || [];
                profile.certKeyChain.push({
                    name: 'set1',
                    cert: p.proxyCaCert.replace(PATH_PREFIX, ''),
                    key: p.proxyCaKey.replace(PATH_PREFIX, ''),
                    chain: 'none',
                    usage: 'CA'
                });
            }
            return profile;
        });
    },
    authenticationTrustCA(result) {
        const trustCA = (result.caFile && result.caFile.fullPath) ? result.caFile.fullPath : 'none';
        return trustCA;
    }
};

const certs = {
    webcert1: {
        class: 'Certificate',
        certificate: '-----BEGIN CERTIFICATE-----\nMIID7TCCAtWgAwIBAgIJAJH4sMVzl1dMMA0GCSqGSIb3DQEBCwUAMIGMMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxEzARBgNVBAMMCnRscy1zZXJ2ZXIxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5jb20wHhcNMTgwMjI4MTkwNzMyWhcNMjgwMjI2MTkwNzMyWjCBjDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxCzAJBgNVBAoMAkY1MQ0wCwYDVQQLDARUZXN0MRMwEQYDVQQDDAp0bHMtc2VydmVyMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwEMNPATg7Vz3jqInIVf2jnOi/9/HYIr8xZYgU0YHHFEiquQ6nYfX4mwezZ6zo9GJom7gHiQ3FNy3fN+RatatZmBmuyvJ+z/uZ6pbKmsuJLPLT89olO9JxMtb4a83oHDz3f6rcc2j8KwTr4lUDc452jLF4ZQ55O17s2tYMg4XW2G5DqUGzp1UKiClaDvpN23ZVOlnqDVpIlnVvJ1mz12AzFPny8xD1lhILv78yMltimdaWhyCLcFom0DbloRvYmowjGLHqLTAZ40jI3YUdw39LEqTXgfDF3DnOgZCIdRpouD9cVZBoQroXpVVfWG7sfzKLqWaAEHhjbhdK5l/p3mT7wIDAQABo1AwTjAdBgNVHQ4EFgQUBlCKIZ0+9DQ4ylW86qsyXoW8KjkwHwYDVR0jBBgwFoAUBlCKIZ0+9DQ4ylW86qsyXoW8KjkwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAuiE5MocznYDc+JHvEgSaiK9fyRBl/bitKTkiOtxWjEFpF5nH6QddV0pqQziXLb6iSbTBwlDJr9Bwzng8moOYbsD7hP2/mCKJj8o/lsRaPAk+abekWXRqYFNucct/ipBG3s+N2PH+MEpy3ioPH1OBuam6UomjE+mqoP09FrQha1hHEbabt4nN11l8fM5GW+0zRU0SwLFvnR58zUSlTMwczSPA0eUrhEU4AGPD/KN8d1fYnCcWqPF5ePcU11k7SNFl5PZQsgXv9cOc2Vq+qc/NmDBO0rQyKEAPDxbM8CK212G1M+ENTqmuePnr+mNope3AhEsqfH8IOPEoT7fIwmpqLw==\n-----END CERTIFICATE-----',
        privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDAQw08BODtXPeOoichV/aOc6L/38dgivzFliBTRgccUSKq5Dqdh9fibB7NnrOj0YmibuAeJDcU3Ld835Fq1q1mYGa7K8n7P+5nqlsqay4ks8tPz2iU70nEy1vhrzegcPPd/qtxzaPwrBOviVQNzjnaMsXhlDnk7Xuza1gyDhdbYbkOpQbOnVQqIKVoO+k3bdlU6WeoNWkiWdW8nWbPXYDMU+fLzEPWWEgu/vzIyW2KZ1paHIItwWibQNuWhG9iajCMYseotMBnjSMjdhR3Df0sSpNeB8MXcOc6BkIh1Gmi4P1xVkGhCuhelVV9Ybux/MoupZoAQeGNuF0rmX+neZPvAgMBAAECggEAHm3eV9v7z4WRxtjiMZRO+Q/TQgUkdKK6y/jtR9DDClfLEVoK7ujTocnz/B48l1ZwHq3Gue6IazxdrB1kUhEFI7lpOQF+t83QCUc8o5OQG437RTfx+PSAa+21rpwBRVrrNfz7HIlsA4jwmq01CPRVUrQLfp7rpNBzbhu0u0Ngrf0ccOwXZkEUVvZ55WaPY1YADI9PBExQ2k04LvHJjoz/tJH3nsQLA/+90UXqy8ctUSMJ8Ko3crxJhnIO91BtCugkgS+U+pTEnvdAebE4pd7J5e6qqEyCu9F3DC5R6hH+K8bAj76VGwjxOr9a90o/js92HoCVAlQMHnW06Uk2RdIRmQKBgQD0uQPlA2PLBysWA+IQvd8oBfZuXWQjUZPBU9MK5k7bfuRbNeCA2kbTt1MVf15lv7vcwrwAbYo+Ur+L9CVL3lA8d/lQkz51r1ISChTPUiAMyU+CDDnXjQ1Gik/nC399AeluxS62Tur8hGPAb4rkVEyU60hPFVZTjmv13n81EjUoNwKBgQDJHyiPIgbwI+OoZYMUcGQrsr+yp1MdJrjpuFloc7+sdUpsvelyc146h3+TSAlhDce2BMH68kMUWUYHxHIooQjtDMu9S9b8VAF52F3E9osyjMzsywTri3hgBPy69j/Kr623gbZpbm6lYmdxRp/FKZyWtAbPts45GH1GPdv+9fUmCQKBgQCX7CfDy1fvWXLhBuYXuJfJs/HpT+bzmhgdA5nXgWRhFSRUj1zhASDJHFzi0qBakC3i/a1Soq4YxKwPCTECKXAsKdrHr7Etw/oyIroKfpRQ+8R1GnvqGbGtIf46k8PAaihtUNIP8Wwl+VYnx9c0qjSkmm/YUIm384mIKGlWHAiN/wKBgDV5bF5KLNASqsguXWDE1U1tFF0a8hVRI185HcSQ6gifku9Au14r4ITtW/U79QpyEISL1Uu0uDMj3WPZToUQ8/+bJFyrWnjymQXdimkBKFeDakUXYbKC/bmB+fR33tQ0S5r8CRUVQKQGevx6S6avfqvvJ9R4hXJW2ZAgiGrM2KaJAoGAPXuy4KHRmeeBZj8AT/shQ0VrDWIMNYDrhx0T6q9hVMahBS0SJaKDlQn6cSF7TX5N9PFAbwzcrvRKKfNjQVSZpQdR4l42f+N/5q0c1wihf43k9FgeYQ8jHGJ05uJnh3nj/O57FKgjlZ4FZVQdR8ieHN+rT4sHWj36a/FLHa6p1oo=\n-----END PRIVATE KEY-----'
    },
    webcert2: {
        class: 'Certificate',
        remark: 'in practice not using a passphrase is not recommended',
        certificate: '-----BEGIN CERTIFICATE-----\nMIID7TCCAtWgAwIBAgIJAJH4sMVzl1dMMA0GCSqGSIb3DQEBCwUAMIGMMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxEzARBgNVBAMMCnRscy1zZXJ2ZXIxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5jb20wHhcNMTgwMjI4MTkwNzMyWhcNMjgwMjI2MTkwNzMyWjCBjDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxCzAJBgNVBAoMAkY1MQ0wCwYDVQQLDARUZXN0MRMwEQYDVQQDDAp0bHMtc2VydmVyMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwEMNPATg7Vz3jqInIVf2jnOi/9/HYIr8xZYgU0YHHFEiquQ6nYfX4mwezZ6zo9GJom7gHiQ3FNy3fN+RatatZmBmuyvJ+z/uZ6pbKmsuJLPLT89olO9JxMtb4a83oHDz3f6rcc2j8KwTr4lUDc452jLF4ZQ55O17s2tYMg4XW2G5DqUGzp1UKiClaDvpN23ZVOlnqDVpIlnVvJ1mz12AzFPny8xD1lhILv78yMltimdaWhyCLcFom0DbloRvYmowjGLHqLTAZ40jI3YUdw39LEqTXgfDF3DnOgZCIdRpouD9cVZBoQroXpVVfWG7sfzKLqWaAEHhjbhdK5l/p3mT7wIDAQABo1AwTjAdBgNVHQ4EFgQUBlCKIZ0+9DQ4ylW86qsyXoW8KjkwHwYDVR0jBBgwFoAUBlCKIZ0+9DQ4ylW86qsyXoW8KjkwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAuiE5MocznYDc+JHvEgSaiK9fyRBl/bitKTkiOtxWjEFpF5nH6QddV0pqQziXLb6iSbTBwlDJr9Bwzng8moOYbsD7hP2/mCKJj8o/lsRaPAk+abekWXRqYFNucct/ipBG3s+N2PH+MEpy3ioPH1OBuam6UomjE+mqoP09FrQha1hHEbabt4nN11l8fM5GW+0zRU0SwLFvnR58zUSlTMwczSPA0eUrhEU4AGPD/KN8d1fYnCcWqPF5ePcU11k7SNFl5PZQsgXv9cOc2Vq+qc/NmDBO0rQyKEAPDxbM8CK212G1M+ENTqmuePnr+mNope3AhEsqfH8IOPEoT7fIwmpqLw==\n-----END CERTIFICATE-----',
        privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDAQw08BODtXPeOoichV/aOc6L/38dgivzFliBTRgccUSKq5Dqdh9fibB7NnrOj0YmibuAeJDcU3Ld835Fq1q1mYGa7K8n7P+5nqlsqay4ks8tPz2iU70nEy1vhrzegcPPd/qtxzaPwrBOviVQNzjnaMsXhlDnk7Xuza1gyDhdbYbkOpQbOnVQqIKVoO+k3bdlU6WeoNWkiWdW8nWbPXYDMU+fLzEPWWEgu/vzIyW2KZ1paHIItwWibQNuWhG9iajCMYseotMBnjSMjdhR3Df0sSpNeB8MXcOc6BkIh1Gmi4P1xVkGhCuhelVV9Ybux/MoupZoAQeGNuF0rmX+neZPvAgMBAAECggEAHm3eV9v7z4WRxtjiMZRO+Q/TQgUkdKK6y/jtR9DDClfLEVoK7ujTocnz/B48l1ZwHq3Gue6IazxdrB1kUhEFI7lpOQF+t83QCUc8o5OQG437RTfx+PSAa+21rpwBRVrrNfz7HIlsA4jwmq01CPRVUrQLfp7rpNBzbhu0u0Ngrf0ccOwXZkEUVvZ55WaPY1YADI9PBExQ2k04LvHJjoz/tJH3nsQLA/+90UXqy8ctUSMJ8Ko3crxJhnIO91BtCugkgS+U+pTEnvdAebE4pd7J5e6qqEyCu9F3DC5R6hH+K8bAj76VGwjxOr9a90o/js92HoCVAlQMHnW06Uk2RdIRmQKBgQD0uQPlA2PLBysWA+IQvd8oBfZuXWQjUZPBU9MK5k7bfuRbNeCA2kbTt1MVf15lv7vcwrwAbYo+Ur+L9CVL3lA8d/lQkz51r1ISChTPUiAMyU+CDDnXjQ1Gik/nC399AeluxS62Tur8hGPAb4rkVEyU60hPFVZTjmv13n81EjUoNwKBgQDJHyiPIgbwI+OoZYMUcGQrsr+yp1MdJrjpuFloc7+sdUpsvelyc146h3+TSAlhDce2BMH68kMUWUYHxHIooQjtDMu9S9b8VAF52F3E9osyjMzsywTri3hgBPy69j/Kr623gbZpbm6lYmdxRp/FKZyWtAbPts45GH1GPdv+9fUmCQKBgQCX7CfDy1fvWXLhBuYXuJfJs/HpT+bzmhgdA5nXgWRhFSRUj1zhASDJHFzi0qBakC3i/a1Soq4YxKwPCTECKXAsKdrHr7Etw/oyIroKfpRQ+8R1GnvqGbGtIf46k8PAaihtUNIP8Wwl+VYnx9c0qjSkmm/YUIm384mIKGlWHAiN/wKBgDV5bF5KLNASqsguXWDE1U1tFF0a8hVRI185HcSQ6gifku9Au14r4ITtW/U79QpyEISL1Uu0uDMj3WPZToUQ8/+bJFyrWnjymQXdimkBKFeDakUXYbKC/bmB+fR33tQ0S5r8CRUVQKQGevx6S6avfqvvJ9R4hXJW2ZAgiGrM2KaJAoGAPXuy4KHRmeeBZj8AT/shQ0VrDWIMNYDrhx0T6q9hVMahBS0SJaKDlQn6cSF7TX5N9PFAbwzcrvRKKfNjQVSZpQdR4l42f+N/5q0c1wihf43k9FgeYQ8jHGJ05uJnh3nj/O57FKgjlZ4FZVQdR8ieHN+rT4sHWj36a/FLHa6p1oo=\n-----END PRIVATE KEY-----',
        chainCA: '-----BEGIN CERTIFICATE-----\nMIID9TCCAt2gAwIBAgIJALxQA/NW2bpRMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxFzAVBgNVBAMMDnRlc3RfQ0FfYnVuZGxlMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUub3JnMB4XDTE4MDIyNzE5MjEyNVoXDTE4MDMyOTE5MjEyNVowgZAxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMQswCQYDVQQKDAJGNTENMAsGA1UECwwEVGVzdDEXMBUGA1UEAwwOdGVzdF9DQV9idW5kbGUxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5vcmcwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCjhUZmbwwuMMFTNic73t0mfJ/pyM3BnEs0riv6lbrF5znFKBlAM2pxWBfkQvr92gUwitij7BqMagnR26/C7GcJJNJQGNK482vgSPhUpGeN0t4W71Dv5SpwJN+0do6gV0eXPwvcgA/XZxXqZAePwXTp36YMrNTgw49OWZpHoNXfYCZ+1KUL032RdQ/Ik2wO/UwV0csL1Rwuu2L8/NI9VtrThCAr8dsMsDJ53jDh7xQdP3K2V9NYtAHk66697kk7TpzR1moqTJxSVaPKo2eDuKNke1BRbjYWoamu0hfC5YG6l5P9i8QaVklbtmDcmoLpU9fLVSSW6CWHkrtdifQiCOChAgMBAAGjUDBOMB0GA1UdDgQWBBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAfBgNVHSMEGDAWgBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQA9r6+6hGVlQ188l+wLFJ1wI83y27BdtE0ZsZGdFv98qi9kcUm17Z0tprEwypODZ1/syt9b1JhD4RgU30qwgeF4kec8UpoG49UkQImRD3AqfsiYSdjZeBpcpEl3n8lkjKGoVY7GB2lMGoWDxv/1A0CSjVTmWgQSFGHoMtzOW1tCr9yGXVEdy691l7PVC1kK5ekwkO8YbSO6hvV/u83KuUiGcIoY1PIzAK301i9YXWUNxybIVfHregoQ11QzjhfdfpOLBTtW1B4QZqZz8qFGIr1remmQK3ljEcct9bWjMLOx2QYMvk6uRFzh+V5L2UnhldNy5wQYMXRDz6SU3LdTJ2OA\n-----END CERTIFICATE-----'
    },
    trustCA: {
        class: 'CA_Bundle',
        bundle: '-----BEGIN CERTIFICATE-----\nMIIDxTCCA0qgAwIBAgICEAAwCgYIKoZIzj0EAwMwgZsxCzAJBgNVBAYTAlVTMQsw\nCQYDVQQIDAJXQTEQMA4GA1UEBwwHU2VhdHRsZTEcMBoGA1UECgwTR3JpbGxlZCBD\naGVlc2UgSW5jLjEfMB0GA1UECwwWR3JpbGxlZCBDaGVlc2UgUm9vdCBDQTEuMCwG\nCSqGSIb3DQEJARYfZ3JpbGxlZGNoZWVzZUB5dW1teWlubXl0dW1teS51czAeFw0x\nOTAyMDYyMDQ2NDFaFw0yODEyMTUyMDQ2NDFaMIHSMQswCQYDVQQGEwJVUzELMAkG\nA1UECAwCV0ExHDAaBgNVBAoME0dyaWxsZWQgQ2hlZXNlIEluYy4xJzAlBgNVBAsM\nHkdyaWxsZWQgQ2hlZXNlIEludGVybWVkaWFyeSBDQTE/MD0GA1UEAww2R3JpbGxl\nZCBDaGVlc2UgSW5jLiBJbnRlcm1lZGlhcnkgQ2VydGlmaWNhdGUgQXV0aG9yaXR5\nMS4wLAYJKoZIhvcNAQkBFh9ncmlsbGVkY2hlZXNlQHl1bW15aW5teXR1bW15LnVz\nMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAETcwKVVKK9DbghS3Dvik+OpLCzoOprWvw\nbOl/IiiX7RxdFgJWsQInI1fzKgMoq4s1aatTUry6wViTX8bUCaiCpNCw5EUZ1bf+\niabKwI42zo+muBES7myVFbFLINoyLaO/o4IBJjCCASIwHQYDVR0OBBYEFNnurRrA\nInHSRpZvxY3SbBlMSBxjMB8GA1UdIwQYMBaAFOh9I+Bl//6eA3hxheJXlhg+SeDd\nMBIGA1UdEwEB/wQIMAYBAf8CAQAwDgYDVR0PAQH/BAQDAgGGMEEGA1UdHwQ6MDgw\nNqA0oDKGMGh0dHA6Ly9jcmwuZ3JpbGxlZGNoZWVzZS51cy93aG9tb3ZlZG15Y2hl\nZXNlLmNybDB5BggrBgEFBQcBAQRtMGswPgYIKwYBBQUHMAKGMmh0dHA6Ly9vY3Nw\nLmdyaWxsZWRjaGVlc2UudXMvY2hlZGRhcmNoZWVzZXJvb3QuY3J0MCkGCCsGAQUF\nBzABhh1odHRwOi8vb2NzcC5ncmlsbGVkY2hlZXNlLnVzLzAKBggqhkjOPQQDAwNp\nADBmAjEA7pS9bNHyxZ7gijiWeQrN8hn+rWCgdDggdvFmhFuvmfvv25w9Bgix5AWx\nRjbdQDhYAjEA7s0DRn1xFxoRv5bYKq9BzdLs2J3Q7SKrW4TjJcMR7fg68IxrXf17\nEdC9gMyUkCGZ\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMIICzzCCAlWgAwIBAgIJAJuPXU1XfaOdMAoGCCqGSM49BAMDMIGbMQswCQYDVQQG\nEwJVUzELMAkGA1UECAwCV0ExEDAOBgNVBAcMB1NlYXR0bGUxHDAaBgNVBAoME0dy\naWxsZWQgQ2hlZXNlIEluYy4xHzAdBgNVBAsMFkdyaWxsZWQgQ2hlZXNlIFJvb3Qg\nQ0ExLjAsBgkqhkiG9w0BCQEWH2dyaWxsZWRjaGVlc2VAeXVtbXlpbm15dHVtbXku\ndXMwHhcNMTkwMjA2MjAzNzE2WhcNMTkwMzA4MjAzNzE2WjCBmzELMAkGA1UEBhMC\nVVMxCzAJBgNVBAgMAldBMRAwDgYDVQQHDAdTZWF0dGxlMRwwGgYDVQQKDBNHcmls\nbGVkIENoZWVzZSBJbmMuMR8wHQYDVQQLDBZHcmlsbGVkIENoZWVzZSBSb290IENB\nMS4wLAYJKoZIhvcNAQkBFh9ncmlsbGVkY2hlZXNlQHl1bW15aW5teXR1bW15LnVz\nMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE18uEnJFBt+yEzbH5NOEcrPwm/Ay6DMJp\nbFkt+c9GYmwJxN7LREaV3v7CMJDiFtUsBKS7E4BzwgxE0/rsjUlBHFzrLXHBbuRR\ne1+SkBkM3TpeLwXtveNdzN2vgTghtE6/o2MwYTAdBgNVHQ4EFgQU6H0j4GX//p4D\neHGF4leWGD5J4N0wHwYDVR0jBBgwFoAU6H0j4GX//p4DeHGF4leWGD5J4N0wDwYD\nVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAYYwCgYIKoZIzj0EAwMDaAAwZQIx\nANsHvQbfAGNSbPfvmtJj8j/9iP8qhO14Rtaiv1CZ8JRCP+CuJiVZ4GVl95dRkt49\nAAIwWEXXpberWlZdTRd4sczN1S706rKZvLgScNRuEltoz/iSEh1MnYZMfuu6kXZ8\nXTuQ\n-----END CERTIFICATE-----'
    }
};

describe('TLS_Server', function () {
    const testName = 'TLS_Server';
    this.timeout(GLOBAL_TIMEOUT);

    function assertTLSServerClass(properties, options) {
        return assertClass(testName, properties, options);
    }

    it('Default Update', () => {
        const tlsServerRef = {
            class: 'Certificate',
            remark: 'in practice not using a passphrase is not recommended',
            certificate: '-----BEGIN CERTIFICATE-----\nMIID0DCCArigAwIBAgIBATANBgkqhkiG9w0BAQUFADB/MQswCQYDVQQGEwJGUjETMBEGA1UECAwKU29tZS1TdGF0ZTEOMAwGA1UEBwwFUGFyaXMxDTALBgNVBAoMBERpbWkxDTALBgNVBAsMBE5TQlUxEDAOBgNVBAMMB0RpbWkgQ0ExGzAZBgkqhkiG9w0BCQEWDGRpbWlAZGltaS5mcjAeFw0xNDAxMjgyMDM2NTVaFw0yNDAxMjYyMDM2NTVaMFsxCzAJBgNVBAYTAkZSMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQxFDASBgNVBAMMC3d3dy5kaW1pLmZyMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvpnaPKLIKdvx98KW68lz8pGaRRcYersNGqPjpifMVjjE8LuCoXgPU0HePnNTUjpShBnynKCvrtWhN+haKbSp+QWXSxiTrW99HBfAl1MDQyWcukoEb9Cw6INctVUN4iRvkn9T8E6q174RbcnwA/7yTc7p1NCvw+6B/aAN9l1G2pQXgRdYC/+G6o1IZEHtWhqzE97nY5QKNuUVD0V09dc5CDYBaKjqetwwv6DFk/GRdOSEd/6bW+20z0qSHpa3YNW6qSp+x5pyYmDrzRIR03os6DauZkChSRyc/Whvurx6o85D6qpzywo8xwNaLZHxTQPgcIA5su9ZIytv9LH2E+lSwwIDAQABo3sweTAJBgNVHRMEAjAAMCwGCWCGSAGG+EIBDQQfFh1PcGVuU1NMIEdlbmVyYXRlZCBDZXJ0aWZpY2F0ZTAdBgNVHQ4EFgQU+tugFtyN+cXe1wxUqeA7X+yS3bgwHwYDVR0jBBgwFoAUhMwqkbBrGp87HxfvwgPnlGgVR64wDQYJKoZIhvcNAQEFBQADggEBAIEEmqqhEzeXZ4CKhE5UM9vCKzkj5Iv9TFs/a9CcQuepzplt7YVmevBFNOc0+1ZyR4tXgi4+5MHGzhYCIVvHo4hKqYm+J+o5mwQInf1qoAHuO7CLD3WNa1sKcVUVvepIxc/1aHZrG+dPeEHt0MdFfOw13YdUc2FH6AqEdcEL4aV5PXq2eYR8hR4zKbc1fBtuqUsvA8NWSIyzQ16fyGve+ANf6vXvUizyvwDrPRv/kfvLNa3ZPnLMMxU98MvhPXy3PkB8++6U4Y3vdk2Ni2WYYlIls8yqbM4327IKmkDc2TimS8u60CT47mKU7aDYcbTV5RDkrlaYwm5yqlTIglvCv7o=\n-----END CERTIFICATE-----',
            privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAvpnaPKLIKdvx98KW68lz8pGaRRcYersNGqPjpifMVjjE8LuCoXgPU0HePnNTUjpShBnynKCvrtWhN+haKbSp+QWXSxiTrW99HBfAl1MDQyWcukoEb9Cw6INctVUN4iRvkn9T8E6q174RbcnwA/7yTc7p1NCvw+6B/aAN9l1G2pQXgRdYC/+G6o1IZEHtWhqzE97nY5QKNuUVD0V09dc5CDYBaKjqetwwv6DFk/GRdOSEd/6bW+20z0qSHpa3YNW6qSp+x5pyYmDrzRIR03os6DauZkChSRyc/Whvurx6o85D6qpzywo8xwNaLZHxTQPgcIA5su9ZIytv9LH2E+lSwwIDAQABAoIBAFml8cD9a5pMqlW3f9btTQz1sRL4Fvp7CmHSXhvjsjeHwhHckEe0ObkWTRsgkTsm1XLu5W8IITnhn0+1iNr+78eB+rRGngdAXh8diOdkEy+8/Cee8tFI3jyutKdRlxMbwiKsouVviumoq3fxOGQYwQ0Z2l/PvCwy/Y82ffq3ysC5gAJsbBYsCrg14bQo44ulrELe4SDWs5HCjKYbEI2b8cOMucqZSOtxg9niLN/je2bo/I2HGSawibgcOdBms8k6TvsSrZMr3kJ5O6J+77LGwKH37brVgbVYvbq6nWPL0xLG7dUv+7LWEo5qQaPy6aXb/zbckqLqu6/EjOVeydG5JQECgYEA9kKfTZD/WEVAreA0dzfeJRu8vlnwoagL7cJaoDxqXos4mcr5mPDTkbWgFkLFFH/AyUnPBlK6BcJp1XK67B13ETUa3i9Q5t1WuZEobiKKBLFm9DDQJt43uKZWJxBKFGSvFrYPtGZst719mZVcPct2CzPjEgN3Hlpt6fyw3eOrnoECgYEAxiOujwXCOmuGaB7+OW2tR0PGEzbvVlEGdkAJ6TC/HoKM1A8r2u4hLTEJJCrLLTfw++4IddHE2dLeR4Q7O58SfLphwgPmLDezN7WRLGr7Vyfuv7VmaHjGuC3Gv9agnhWDlA2QgBG9/R9oVfL0Dc7CgJgLeUtItCYC31bGT3yhV0MCgYEA4k3DG4L+RN4PXDpHvK9IpA1jXAJHEifeHnaW1d3vWkbSkvJmgVf+9U5VeV+OwRHN1qzPZV4suRI6M/8lK8rAGr4UnM4aqK4K/qkY4G05LKrik9Ev2CgqSLQDRA7CJQ+Jn3Nb50qg6hFnFPafN+J77juWln08wFYV4Atpdd+9XQECgYBxizkZFL+9IqkfOcONvWAzGo+Dq1N0L3J4iTIkw56CKWXyj88d4qB4eUU3yJ4uB4S9miaW/eLEwKZIbWpUPFAn0db7i6h3ZmP5ZL8QqS3nQCb9DULmU2/tU641eRUKAmIoka1g9sndKAZuWo+o6fdkIb1RgObk9XNn8R4rpsv+aQKBgB+CIcExR30vycv5bnZN9EFlIXNKaeMJUrYCXcRQNvrnUIUBvAO8+jAeCdLygS5RtgOLZib0IVErqWsP3EI1ACGuLts0vQ9GFLQGaN1SaMS40C9kvns1mlDuLhIhYpJ8UsCVt5snWo2N+M+6ANh5tpWdQnEK6zILh4tRbuzaiHgb\n-----END RSA PRIVATE KEY-----'
        };
        tlsServerRef.chainCA = certs.webcert2.chainCA;
        let staplerEnabledExpected = [undefined];
        tlsServerRef.issuerCertificate = {
            bigip: '/Common/certOne.crt'
        };
        tlsServerRef.staplerOCSP = {
            use: 'theStapler'
        };
        const staplerRef = {
            class: 'Certificate_Validator_OCSP',
            dnsResolver: { bigip: '/Common/198.168.111.22' },
            responderUrl: 'http://oscp.localhost.com'
        };
        staplerEnabledExpected = ['disabled', 'enabled', 'enabled', 'disabled'];

        const properties = [
            // Required
            {
                name: 'certificates',
                inputValue: [
                    [{ certificate: 'tlsservercert' }],
                    [{ certificate: 'tlsservercert', sniDefault: true }],
                    [{ certificate: 'tlsservercert' }]
                ],
                expectedValue: [
                    [`/TEST_${testName}/Application/tlsservercert.crt`, 'true'],
                    [`/TEST_${testName}/Application/tlsservercert.crt`, 'true'],
                    [`/TEST_${testName}/Application/tlsservercert.crt`, 'true']
                ],
                referenceObjects: {
                    tlsservercert: tlsServerRef,
                    theStapler: staplerRef
                },
                extractFunction: (o) => [
                    o.certKeyChain[0].cert,
                    o.sniDefault
                ]
            },

            // Tested
            {
                name: 'remark',
                inputValue: [undefined, 'description', 'description', undefined],
                expectedValue: ['none', 'description', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'requireSNI',
                inputValue: [undefined, true, undefined],
                expectedValue: ['false', 'true', 'false']
            },
            {
                name: 'alertTimeout',
                inputValue: [undefined, 86400, 86400, undefined],
                expectedValue: ['indefinite', '86400', '86400', 'indefinite']
            },
            {
                name: 'cacheTimeout',
                inputValue: [undefined, 100, 100, undefined],
                expectedValue: [3600, 100, 100, 3600]
            },
            {
                name: 'ciphers',
                inputValue: [undefined, 'DEFAULT:+SHA:+3DES', 'DEFAULT:+SHA:+3DES', undefined],
                expectedValue: ['DEFAULT', 'DEFAULT:+SHA:+3DES', 'DEFAULT:+SHA:+3DES', 'DEFAULT']
            },
            {
                name: 'authenticationMode',
                inputValue: [undefined, 'request', 'request', undefined],
                expectedValue: ['ignore', 'request', 'request', 'ignore']
            },
            {
                name: 'authenticationFrequency',
                inputValue: [undefined, 'every-time', 'every-time', undefined],
                expectedValue: ['once', 'always', 'always', 'once']
            },
            {
                name: 'authenticationTrustCA',
                inputValue: [undefined, { bigip: '/Common/ca-bundle.crt' }, { bigip: '/Common/ca-bundle.crt' }, undefined],
                expectedValue: ['none', '/Common/ca-bundle.crt', '/Common/ca-bundle.crt', 'none'],
                extractFunction: extractFunctions.authenticationTrustCA
            },
            {
                name: 'authenticationInviteCA',
                inputValue: [undefined, { bigip: '/Common/ca-bundle.crt' }, { bigip: '/Common/ca-bundle.crt' }, 'existingCA'],
                expectedValue: ['none', '/Common/ca-bundle.crt', '/Common/ca-bundle.crt', '/Common/ca-bundle.crt'],
                extractFunction: (o) => {
                    const result = (o.clientCertCa && o.clientCertCa.fullPath) ? o.clientCertCa.fullPath : 'none';
                    return result;
                },
                referenceObjects: {
                    existingCA: {
                        class: 'CA_Bundle',
                        bundle: { bigip: '/Common/ca-bundle.crt' }
                    }
                }
            },
            {
                name: 'ldapStartTLS',
                inputValue: [undefined, 'allow', undefined, undefined],
                expectedValue: [undefined, 'f5_appsvcs_clientside_allow', undefined, undefined],
                extractFunction: (o, expected) => {
                    const RETRY_OPTIONS = {
                        retryCount: 5,
                        retryInterval: 1000,
                        retryIf: (error, response) => response && response.statusCode === 503
                    };
                    const requestOptions = {
                        path: '/mgmt/tm/ltm/profile/client-ldap',
                        host: process.env.TARGET_HOST || process.env.AS3_HOST
                    };
                    return requestUtil
                        .get(Object.assign(requestOptions, RETRY_OPTIONS))
                        .then((response) => {
                            const foundName = response.body.items.find((i) => i.name === expected);
                            return (foundName) ? foundName.name : foundName;
                        });
                }
            },
            {
                name: 'smtpsStartTLS',
                inputValue: [undefined, undefined, 'allow', undefined],
                expectedValue: [undefined, undefined, 'f5_appsvcs_smtps_allow', undefined],
                extractFunction: (o, expected) => {
                    const RETRY_OPTIONS = {
                        retryCount: 5,
                        retryInterval: 1000,
                        retryIf: (error, response) => response && response.statusCode === 503
                    };
                    const requestOptions = {
                        path: '/mgmt/tm/ltm/profile/smtps',
                        host: process.env.TARGET_HOST || process.env.AS3_HOST
                    };
                    return requestUtil
                        .get(Object.assign(requestOptions, RETRY_OPTIONS))
                        .then((response) => {
                            const foundName = response.body.items.find((i) => i.name === expected);
                            return (foundName) ? foundName.name : foundName;
                        });
                }
            },
            {
                name: 'staplerOCSPEnabled',
                inputValue: [undefined, true, true, undefined],
                expectedValue: staplerEnabledExpected,
                extractFunction: (o) => o.ocspStapling
            },
            {
                name: 'renegotiationEnabled',
                inputValue: [undefined, false, false, undefined],
                expectedValue: ['enabled', 'disabled', 'disabled', 'enabled']
            },
            {
                name: 'retainCertificateEnabled',
                inputValue: [undefined, false, false, undefined],
                expectedValue: ['true', 'false', 'false', 'true']
            },
            {
                name: 'sslEnabled',
                inputValue: [undefined, false, false, undefined],
                expectedValue: ['enabled', 'disabled', 'disabled', 'enabled'],
                extractFunction: (o) => (o.tmOptions.indexOf('no-ssl') >= 0 ? 'disabled' : 'enabled')
            },
            {
                name: 'ssl3Enabled',
                inputValue: [undefined, false, false, undefined],
                expectedValue: ['enabled', 'disabled', 'disabled', 'enabled'],
                extractFunction: (o) => (o.tmOptions.indexOf('no-sslv3') >= 0 ? 'disabled' : 'enabled')
            },
            {
                name: 'secureRenegotiation',
                inputValue: [undefined, 'require-strict', 'require-strict', undefined],
                expectedValue: ['require', 'require-strict', 'require-strict', 'require']
            },
            {
                name: 'uncleanShutdownEnabled',
                inputValue: [undefined, false, false, undefined],
                expectedValue: ['enabled', 'disabled', 'disabled', 'enabled']
            },
            {
                name: 'certificateExtensions',
                inputValue: [
                    undefined,
                    [
                        'basic-constraints',
                        'subject-alternative-name'
                    ],
                    [
                        'basic-constraints',
                        'subject-alternative-name'
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        'basic-constraints',
                        'subject-alternative-name'
                    ],
                    [
                        'basic-constraints',
                        'subject-alternative-name'
                    ],
                    []
                ]
            },
            {
                name: 'nonSslConnectionsEnabled',
                inputValue: [undefined, true, true, undefined],
                expectedValue: ['disabled', 'enabled', 'enabled', 'disabled']
            },
            {
                name: 'allowDynamicRecordSizing',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'renegotiateMaxRecordDelay',
                inputValue: [undefined, 100, undefined],
                expectedValue: ['indefinite', '100', 'indefinite']
            },
            {
                name: 'renegotiatePeriod',
                inputValue: [undefined, 100, undefined],
                expectedValue: ['indefinite', '100', 'indefinite']
            },
            {
                name: 'renegotiateSize',
                inputValue: [undefined, 100, undefined],
                expectedValue: ['indefinite', '100', 'indefinite']
            },
            {
                name: 'sslSignHash',
                inputValue: [undefined, 'sha256', undefined],
                expectedValue: ['any', 'sha256', 'any']
            },
            {
                name: 'handshakeTimeout',
                inputValue: [undefined, 1234, undefined],
                expectedValue: [10, 1234, 10]
            }
        ];

        if (!util.versionLessThan(getBigIpVersion(), '15.1')) {
            properties.push(
                {
                    name: 'dataZeroRoundTripTime',
                    inputValue: [undefined, 'enabled-with-anti-replay', undefined],
                    expectedValue: ['disabled', 'enabled-with-anti-replay', 'disabled'],
                    extractFunction: (o) => o.data_0rtt
                }
            );
        }

        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/shared/file-transfer/uploads/certOne',
                    data: '-----BEGIN CERTIFICATE-----\nMIIDyTCCArGgAwIBAgIBADANBgkqhkiG9w0BAQUFADB/MQswCQYDVQQGEwJGUjET\nMBEGA1UECAwKU29tZS1TdGF0ZTEOMAwGA1UEBwwFUGFyaXMxDTALBgNVBAoMBERp\nbWkxDTALBgNVBAsMBE5TQlUxEDAOBgNVBAMMB0RpbWkgQ0ExGzAZBgkqhkiG9w0B\nCQEWDGRpbWlAZGltaS5mcjAeFw0xNDAxMjgyMDI2NDRaFw0yNDAxMjYyMDI2NDRa\nMH8xCzAJBgNVBAYTAkZSMRMwEQYDVQQIDApTb21lLVN0YXRlMQ4wDAYDVQQHDAVQ\nYXJpczENMAsGA1UECgwERGltaTENMAsGA1UECwwETlNCVTEQMA4GA1UEAwwHRGlt\naSBDQTEbMBkGCSqGSIb3DQEJARYMZGltaUBkaW1pLmZyMIIBIjANBgkqhkiG9w0B\nAQEFAAOCAQ8AMIIBCgKCAQEAuxuG4QeBIGXj/AB/YRLLtpgpTpGnDntVlgsycZrL\n3qqyOdBNlwnvcB9etfY5iWzjeq7YZRr6i0dIV4sFNBR2NoK+YvdD9j1TRi7njZg0\nd6zth0xlsOhCsDlV/YCL1CTcYDlKA/QiKeIQa7GU3Rhf0t/KnAkr6mwoDbdKBQX1\nD5HgQuXJiFdh5XRebxF1ZB3gH+0kCEaEZPrjFDApkOXNxEARZdpBLpbvQljtVXtj\nHMsvrIOc7QqUSOU3GcbBMSHjT8cgg8ssf492Go3bDQkIzTROz9QgDHaqDqTC9Hoe\nvlIpTS+q/3BCY5AGWKl3CCR6dDyK6honnOR/8srezaN4PwIDAQABo1AwTjAdBgNV\nHQ4EFgQUhMwqkbBrGp87HxfvwgPnlGgVR64wHwYDVR0jBBgwFoAUhMwqkbBrGp87\nHxfvwgPnlGgVR64wDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQUFAAOCAQEAVqYq\nvhm5wAEKmvrKXRjeb5kiEIp7oZAFkYp6sKODuZ1VdkjMDD4wv46iqAe1QIIsfGwd\nDmv0oqSl+iPPy24ATMSZQbPLO5K64Hw7Q8KPos0yD8gHSg2d4SOukj+FD2IjAH17\na8auMw7TTHu6976JprQQKtPADRcfodGd5UFiz/6ZgLzUE23cktJMc2Bt18B9OZII\nJ9ef2PZxZirJg1OqF2KssDlJP5ECo9K3EmovC5M5Aly++s8ayjBnNivtklYL1VOT\nZrpPgcndTHUA5KS/Duf40dXm0snCxLAKNP28pMowDLSYc6IjVrD4+qqw3f1b7yGb\nbJcFgxKDeg5YecQOSg==\n-----END CERTIFICATE-----',
                    headers: {
                        'Content-Range': '0-1373/1374',
                        'Content-Type': 'text/plain'
                    }
                },
                {
                    endpoint: '/mgmt/tm/sys/file/ssl-cert',
                    data: {
                        name: 'certOne.crt',
                        partition: 'Common',
                        sourcePath: 'file:///var/config/rest/downloads/certOne'
                    }
                },
                {
                    endpoint: '/mgmt/tm/net/dns-resolver',
                    data: {
                        name: '198.168.111.22',
                        partition: 'Common',
                        routeDomain: '/Common/0'
                    }
                }
            ]
        };
        return assertTLSServerClass(properties, options);
    });

    it('SNI multiple certs - creates a profile for each cert', () => {
        const properties = [
            {
                name: 'certificates',
                inputValue: [[
                    {
                        enabled: false,
                        certificate: 'webcert1'
                    },
                    {
                        matchToSNI: 'www.wheeee.com',
                        certificate: 'webcert2',
                        sniDefault: true
                    }
                ]],
                expectedValue: [[
                    {
                        name: getItemName({ tenantName: `TEST_${testName}` }),
                        cert: 'webcert1.crt',
                        key: 'webcert1.key',
                        certKeyChain: [
                            {
                                name: 'set0',
                                cert: 'webcert1.crt',
                                key: 'webcert1.key',
                                chain: 'none',
                                usage: 'SERVER'
                            }
                        ],
                        mode: 'disabled',
                        serverName: 'none',
                        sniDefault: 'false'
                    },
                    {
                        name: `${getItemName({ tenantName: `TEST_${testName}` })}-1-`,
                        cert: 'webcert2.crt',
                        key: 'webcert2.key',
                        certKeyChain: [
                            {
                                name: 'set0',
                                cert: 'webcert2.crt',
                                key: 'webcert2.key',
                                chain: 'webcert2-bundle.crt',
                                usage: 'SERVER'
                            }
                        ],
                        mode: 'enabled',
                        serverName: 'www.wheeee.com',
                        sniDefault: 'true'
                    }
                ]],
                referenceObjects: {
                    webcert1: certs.webcert1,
                    webcert2: certs.webcert2
                },
                extractFunction: extractFunctions.certs
            }
        ];
        const options = {
            findAll: true
        };
        return assertTLSServerClass(properties, options);
    });

    it('C3D Features (v13.1+) and CRL', function () {
        const properties = [
            {
                name: 'certificates',
                inputValue: [[
                    {
                        certificate: 'testWebcert'
                    }
                ]],
                expectedValue: [`/TEST_${testName}/Application/testWebcert.crt`],
                referenceObjects: {
                    testWebcert: certs.webcert1
                },
                extractFunction: (o) => o.certKeyChain[0].cert
            },
            {
                name: 'authenticationTrustCA',
                inputValue: ['testTrustCA'],
                expectedValue: [`/TEST_${testName}/Application/testTrustCA`],
                extractFunction: extractFunctions.authenticationTrustCA,
                referenceObjects: {
                    testTrustCA: certs.trustCA
                }
            },
            {
                name: 'authenticationMode',
                inputValue: ['request', 'require', 'request'],
                expectedValue: ['request', 'require', 'request']
            },
            {
                name: 'crlFile',
                inputValue: [undefined, { bigip: '/Common/testTlsServerCRL.crl' }, undefined],
                expectedValue: ['none', '/Common/testTlsServerCRL.crl', 'none'],
                extractFunction: (o) => {
                    let result = 'none';
                    if (o.crlFile) {
                        if (typeof o.crlFile === 'object') {
                            result = o.crlFile.fullPath;
                        } else {
                            result = o.crlFile;
                        }
                    }
                    return result;
                }
            },
            {
                name: 'allowExpiredCRL',
                inputValue: [undefined, true, false],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                extractFunction: (o) => o.allowExpiredCrl
            },
            {
                name: 'c3dOCSPUnknownStatusAction',
                inputValue: [undefined, 'ignore', 'drop'],
                expectedValue: ['drop', 'ignore', 'drop'],
                extractFunction: (o) => o.c3dDropUnknownOcspStatus
            },
            {
                name: 'c3dOCSP',
                inputValue: [undefined, { use: 'testOcsp' }, undefined],
                expectedValue: ['none', `${PATH_PREFIX}testOcsp`, 'none'],
                referenceObjects: {
                    testOcsp: {
                        class: 'Certificate_Validator_OCSP',
                        dnsResolver: { bigip: '/Common/198.168.111.22' },
                        timeout: 250,
                        responderUrl: 'http://oscp.localhost.com'
                    }
                },
                extractFunction: (o) => {
                    let result = 'none';
                    if (o.c3dOcsp) {
                        if (typeof o.c3dOcsp === 'object') {
                            result = o.c3dOcsp.fullPath;
                        } else {
                            result = o.c3dOcsp;
                        }
                    }
                    return result;
                }
            },
            {
                name: 'c3dEnabled',
                inputValue: [undefined, true, false],
                expectedValue: ['disabled', 'enabled', 'disabled']
            }
        ];
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/shared/file-transfer/uploads/testTlsServerCRL',
                    data: '-----BEGIN X509 CRL-----\nMIIBrjCCATQCAQEwCgYIKoZIzj0EAwMwgdIxCzAJBgNVBAYTAlVTMQswCQYDVQQI\nDAJXQTEcMBoGA1UECgwTR3JpbGxlZCBDaGVlc2UgSW5jLjEnMCUGA1UECwweR3Jp\nbGxlZCBDaGVlc2UgSW50ZXJtZWRpYXJ5IENBMT8wPQYDVQQDDDZHcmlsbGVkIENo\nZWVzZSBJbmMuIEludGVybWVkaWFyeSBDZXJ0aWZpY2F0ZSBBdXRob3JpdHkxLjAs\nBgkqhkiG9w0BCQEWH2dyaWxsZWRjaGVlc2VAeXVtbXlpbm15dHVtbXkudXMXDTE5\nMDIwNjIwNTc1M1oXDTE5MDgwNTIwNTc1M1qgMDAuMB8GA1UdIwQYMBaAFNnurRrA\nInHSRpZvxY3SbBlMSBxjMAsGA1UdFAQEAgIQADAKBggqhkjOPQQDAwNoADBlAjEA\notYkHQXCwkuS08FVReEtSDqGX2FTUA7JusDnqv3uCG37jo4ZSHwrykJgxlTGcIlq\nAjBL0LhpeFa7rTXgxddjvy/nVy+rSydAHpNreAOrtCNDQRFrHFoQM9ihI4yXNhFG\nE6Y=\n-----END X509 CRL-----\n',
                    headers: {
                        'Content-Range': '0-637/638',
                        'Content-Type': 'text/plain'
                    }
                },
                {
                    endpoint: '/mgmt/tm/net/dns-resolver',
                    data: {
                        name: '198.168.111.22',
                        partition: 'Common',
                        routeDomain: '/Common/0'
                    }
                },
                {
                    endpoint: '/mgmt/tm/sys/file/ssl-crl',
                    data: {
                        name: 'testTlsServerCRL.crl',
                        partition: 'Common',
                        sourcePath: 'file:///var/config/rest/downloads/testTlsServerCRL'
                    }
                }
            ]
        };
        return assertTLSServerClass(properties, options);
    });

    it('Enable TLS 1.3', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.0')) {
            this.skip();
        }

        const enabled = 'tls 1.3 Enabled';
        const disabled = 'tls 1.3 Disabled';
        const properties = [
            {
                name: 'certificates',
                inputValue: [[
                    {
                        certificate: 'testWebcert'
                    }
                ]],
                skipAssert: true,
                referenceObjects: {
                    testWebcert: certs.webcert1
                }
            },
            {
                name: 'authenticationTrustCA',
                inputValue: ['testTrustCA'],
                skipAssert: true,
                referenceObjects: {
                    testTrustCA: certs.trustCA
                }
            },
            {
                name: 'authenticationMode',
                inputValue: ['request'],
                skipAssert: true
            },
            {
                name: 'cipherGroup',
                inputValue: [undefined, { bigip: '/Common/f5-aes' }, undefined],
                skipAssert: true
            },
            {
                name: 'tls1_3Enabled',
                inputValue: [undefined, true, undefined],
                expectedValue: [disabled, enabled, disabled],
                extractFunction: (o) => (o.tmOptions.indexOf('no-tlsv1.3') >= 0 ? disabled : enabled)
            }
        ];
        return assertTLSServerClass(properties);
    });

    it('Test universal TLS options', function () {
        const checkEnabled = function (o, name) {
            // Later versions of BIG-IP sets the tmOptions as a string not an array
            const optionArray = (Array.isArray(o.tmOptions)) ? o.tmOptions : o.tmOptions.split(' ');
            return (optionArray.indexOf(name) >= 0 ? 'Enabled' : 'Disabled');
        };

        const properties = [
            {
                name: 'insertEmptyFragmentsEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['Enabled', 'Disabled', 'Enabled'],
                extractFunction: (o) => checkEnabled(o, 'dont-insert-empty-fragments')
            },
            {
                name: 'singleUseDhEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['Disabled', 'Enabled', 'Disabled'],
                extractFunction: (o) => checkEnabled(o, 'single-dh-use')
            },
            {
                name: 'tls1_2Enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['Disabled', 'Enabled', 'Disabled'],
                extractFunction: (o) => checkEnabled(o, 'no-tlsv1.2')
            },
            {
                name: 'tls1_1Enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['Disabled', 'Enabled', 'Disabled'],
                extractFunction: (o) => checkEnabled(o, 'no-tlsv1.1')
            },
            {
                name: 'tls1_0Enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['Disabled', 'Enabled', 'Disabled'],
                extractFunction: (o) => checkEnabled(o, 'no-tlsv1')
            },
            {
                name: 'certificates',
                inputValue: [[
                    {
                        certificate: 'testWebcert'
                    }
                ]],
                skipAssert: true,
                referenceObjects: {
                    testWebcert: certs.webcert1
                }
            },
            {
                name: 'authenticationTrustCA',
                inputValue: ['testTrustCA'],
                skipAssert: true,
                referenceObjects: {
                    testTrustCA: certs.trustCA
                }
            },
            {
                name: 'authenticationMode',
                inputValue: ['request'],
                skipAssert: true
            },
            {
                name: 'cipherGroup',
                inputValue: [undefined, { bigip: '/Common/f5-aes' }, undefined],
                skipAssert: true
            }
        ];

        return assertTLSServerClass(properties);
    });

    it('References Cipher_Group (v13.0+)', function () {
        const tlsServerRef = {
            class: 'Certificate',
            remark: 'in practice not using a passphrase is not recommended',
            certificate: '-----BEGIN CERTIFICATE-----\nMIID0DCCArigAwIBAgIBATANBgkqhkiG9w0BAQUFADB/MQswCQYDVQQGEwJGUjETMBEGA1UECAwKU29tZS1TdGF0ZTEOMAwGA1UEBwwFUGFyaXMxDTALBgNVBAoMBERpbWkxDTALBgNVBAsMBE5TQlUxEDAOBgNVBAMMB0RpbWkgQ0ExGzAZBgkqhkiG9w0BCQEWDGRpbWlAZGltaS5mcjAeFw0xNDAxMjgyMDM2NTVaFw0yNDAxMjYyMDM2NTVaMFsxCzAJBgNVBAYTAkZSMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQxFDASBgNVBAMMC3d3dy5kaW1pLmZyMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvpnaPKLIKdvx98KW68lz8pGaRRcYersNGqPjpifMVjjE8LuCoXgPU0HePnNTUjpShBnynKCvrtWhN+haKbSp+QWXSxiTrW99HBfAl1MDQyWcukoEb9Cw6INctVUN4iRvkn9T8E6q174RbcnwA/7yTc7p1NCvw+6B/aAN9l1G2pQXgRdYC/+G6o1IZEHtWhqzE97nY5QKNuUVD0V09dc5CDYBaKjqetwwv6DFk/GRdOSEd/6bW+20z0qSHpa3YNW6qSp+x5pyYmDrzRIR03os6DauZkChSRyc/Whvurx6o85D6qpzywo8xwNaLZHxTQPgcIA5su9ZIytv9LH2E+lSwwIDAQABo3sweTAJBgNVHRMEAjAAMCwGCWCGSAGG+EIBDQQfFh1PcGVuU1NMIEdlbmVyYXRlZCBDZXJ0aWZpY2F0ZTAdBgNVHQ4EFgQU+tugFtyN+cXe1wxUqeA7X+yS3bgwHwYDVR0jBBgwFoAUhMwqkbBrGp87HxfvwgPnlGgVR64wDQYJKoZIhvcNAQEFBQADggEBAIEEmqqhEzeXZ4CKhE5UM9vCKzkj5Iv9TFs/a9CcQuepzplt7YVmevBFNOc0+1ZyR4tXgi4+5MHGzhYCIVvHo4hKqYm+J+o5mwQInf1qoAHuO7CLD3WNa1sKcVUVvepIxc/1aHZrG+dPeEHt0MdFfOw13YdUc2FH6AqEdcEL4aV5PXq2eYR8hR4zKbc1fBtuqUsvA8NWSIyzQ16fyGve+ANf6vXvUizyvwDrPRv/kfvLNa3ZPnLMMxU98MvhPXy3PkB8++6U4Y3vdk2Ni2WYYlIls8yqbM4327IKmkDc2TimS8u60CT47mKU7aDYcbTV5RDkrlaYwm5yqlTIglvCv7o=\n-----END CERTIFICATE-----',
            privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAvpnaPKLIKdvx98KW68lz8pGaRRcYersNGqPjpifMVjjE8LuCoXgPU0HePnNTUjpShBnynKCvrtWhN+haKbSp+QWXSxiTrW99HBfAl1MDQyWcukoEb9Cw6INctVUN4iRvkn9T8E6q174RbcnwA/7yTc7p1NCvw+6B/aAN9l1G2pQXgRdYC/+G6o1IZEHtWhqzE97nY5QKNuUVD0V09dc5CDYBaKjqetwwv6DFk/GRdOSEd/6bW+20z0qSHpa3YNW6qSp+x5pyYmDrzRIR03os6DauZkChSRyc/Whvurx6o85D6qpzywo8xwNaLZHxTQPgcIA5su9ZIytv9LH2E+lSwwIDAQABAoIBAFml8cD9a5pMqlW3f9btTQz1sRL4Fvp7CmHSXhvjsjeHwhHckEe0ObkWTRsgkTsm1XLu5W8IITnhn0+1iNr+78eB+rRGngdAXh8diOdkEy+8/Cee8tFI3jyutKdRlxMbwiKsouVviumoq3fxOGQYwQ0Z2l/PvCwy/Y82ffq3ysC5gAJsbBYsCrg14bQo44ulrELe4SDWs5HCjKYbEI2b8cOMucqZSOtxg9niLN/je2bo/I2HGSawibgcOdBms8k6TvsSrZMr3kJ5O6J+77LGwKH37brVgbVYvbq6nWPL0xLG7dUv+7LWEo5qQaPy6aXb/zbckqLqu6/EjOVeydG5JQECgYEA9kKfTZD/WEVAreA0dzfeJRu8vlnwoagL7cJaoDxqXos4mcr5mPDTkbWgFkLFFH/AyUnPBlK6BcJp1XK67B13ETUa3i9Q5t1WuZEobiKKBLFm9DDQJt43uKZWJxBKFGSvFrYPtGZst719mZVcPct2CzPjEgN3Hlpt6fyw3eOrnoECgYEAxiOujwXCOmuGaB7+OW2tR0PGEzbvVlEGdkAJ6TC/HoKM1A8r2u4hLTEJJCrLLTfw++4IddHE2dLeR4Q7O58SfLphwgPmLDezN7WRLGr7Vyfuv7VmaHjGuC3Gv9agnhWDlA2QgBG9/R9oVfL0Dc7CgJgLeUtItCYC31bGT3yhV0MCgYEA4k3DG4L+RN4PXDpHvK9IpA1jXAJHEifeHnaW1d3vWkbSkvJmgVf+9U5VeV+OwRHN1qzPZV4suRI6M/8lK8rAGr4UnM4aqK4K/qkY4G05LKrik9Ev2CgqSLQDRA7CJQ+Jn3Nb50qg6hFnFPafN+J77juWln08wFYV4Atpdd+9XQECgYBxizkZFL+9IqkfOcONvWAzGo+Dq1N0L3J4iTIkw56CKWXyj88d4qB4eUU3yJ4uB4S9miaW/eLEwKZIbWpUPFAn0db7i6h3ZmP5ZL8QqS3nQCb9DULmU2/tU641eRUKAmIoka1g9sndKAZuWo+o6fdkIb1RgObk9XNn8R4rpsv+aQKBgB+CIcExR30vycv5bnZN9EFlIXNKaeMJUrYCXcRQNvrnUIUBvAO8+jAeCdLygS5RtgOLZib0IVErqWsP3EI1ACGuLts0vQ9GFLQGaN1SaMS40C9kvns1mlDuLhIhYpJ8UsCVt5snWo2N+M+6ANh5tpWdQnEK6zILh4tRbuzaiHgb\n-----END RSA PRIVATE KEY-----'
        };
        const properties = [
            {
                name: 'certificates',
                inputValue: [
                    [{ certificate: 'tlsservercert' }]
                ],
                expectedValue: [
                    `/TEST_${testName}/Application/tlsservercert.crt`
                ],
                referenceObjects: {
                    tlsservercert: tlsServerRef
                },
                extractFunction: (o) => o.certKeyChain[0].cert
            },
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'cipherGroup',
                inputValue: [undefined, { bigip: '/Common/f5-secure' }, undefined],
                expectedValue: ['none', '/Common/f5-secure', 'none'],
                extractFunction: (o) => o.cipherGroup.fullPath || o.cipherGroup
            }
        ];

        return assertTLSServerClass(properties);
    });

    it('Forward Proxy Feature - Multiple Certs', () => {
        const proxyCert = {
            class: 'Certificate',
            certificate: '-----BEGIN CERTIFICATE-----\nMIIDejCCAmKgAwIBAgIEEScJETANBgkqhkiG9w0BAQsFADB/MQswCQYDVQQGEwJV\nUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxCzAJBgNVBAoTAkY1MREw\nDwYDVQQLEwhEZXYvVGVzdDERMA8GA1UEAxMIYzNkLnRlc3QxHjAcBgkqhkiG9w0B\nCQEWD2MzZF90ZXN0QGY1LmNvbTAeFw0xOTAyMTQwMDIxMzdaFw0yOTAyMTEwMDIx\nMzdaMH8xCzAJBgNVBAYTAlVTMQswCQYDVQQIEwJXQTEQMA4GA1UEBxMHU2VhdHRs\nZTELMAkGA1UEChMCRjUxETAPBgNVBAsTCERldi9UZXN0MREwDwYDVQQDEwhjM2Qu\ndGVzdDEeMBwGCSqGSIb3DQEJARYPYzNkX3Rlc3RAZjUuY29tMIIBIjANBgkqhkiG\n9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4TewabffHuFqkGImbYeguZP528rImQBrDJ83\nFrax15gpABnpUitXPKPNxkmvi7oRAcOiXc6+6pFZioCUTw6uWL29mRByuXKqWv7c\naIvw8U8JeLtFtpZBPJNvrO1VPDcFS2FYxUS5auzJs2kDh/YmKytcU2PKe/yMd+Q9\nqAhIb10wxNFm4coq3Ezxlaw2heboyMYlAz+eRA7gDlXpv3OMCPhKo6Qx242VV0CU\nNxnqJx0MweqoQsejOF3caZRBwxmbNQMhDhrNNKv9vAGZeGCZGM/x56jJubTbJlbh\nY6CqZPdgxicc47RT8widQ+/MoHihC4rbNdUPM8tywgUJRmp91QIDAQABMA0GCSqG\nSIb3DQEBCwUAA4IBAQBFz5VHcF8OwjeKeJdbgoZFzOKHBATW8cUvx57d0fi5Xqck\nNCob+S91DvkCznkgrNOvcn9OotPmTXAB6uxGsnyVRo1X1Y8kUnj0KrIsPdZ+fUfS\nuPw4kUHKPY+XTLluNIXY1Yja3gXifC/0FokfMRDJQXkxmHijJqepk4UTv+A1gYYU\n2xVQ4EiX3JxB1dXqu7ov1hAEbOHHZnRNEbnHhkxBr7UCW1u5PGmBMVbOKopuVWPY\nMtYwebTv0LhPRaySE/jJekj1yxtVVlDLBOjNkrm8ubcN2apxK4HuqqdSLbmWNqSN\nAeJxKwVsp2ODpOOWU3WlDuFuuLF6NgFfu2A4Jxq+\n-----END CERTIFICATE-----',
            privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,88D5CDC828B89D3DAB310589A45A26A9\n\nQHdPM4CtWCHRb+K2F87UPUs5AeyVuvDe28JWA9/SV3UsTwJBHS+wPKbOHxpEBtR6\nD4Pr7cvqbnkI8WG1XS3x7aEhamzK+OT/H+IOLInOj7ir6N6YZ+W8EMQFjZoRuYlA\ntnpRSlfEMhg+EAIeqf+iRo8JC6G3HlWuow5uZuv9rJS33NcFI8zw+je+8vQTIVTN\ndTrGSqdzb/bjgbK483/lUmYTpxenO3diCNxmzVP2bvCPISAh6ODwIaQirlahWknk\nSrEQZbkjWegwCsA7J6l0MJfmBiVdRRWvHZAcskINp24gH6MSzCdPOr8w5hQt9izz\n8KtaflZLlGz+2jaZ452J7EO+DauVtKXaz7RWxZKNno22YdO3QCk098FmENa3KbIr\nehUn15jnT/EZZFyUd2G79Hff/tTNx6LrKeZiKVtAyT23qUyd+U0CohXOhNYd9UC+\nRGg0yipXewmN/dM2k9t1kDIxP2MccsmyiIS+BA5+WxtHOtRYgfHw+TI6amDS/7w0\nnvubzYgK9ZohCgRNHbp1XW4udkL53edXVybP6vmdw48ARxpzY0tlkz+KhYFFqss3\nLClT/T8il1iGWmsNhS40roQFJ/geDCoZ0pAnrULmd0YCuoSNLCsKJwtzGSY4ySIT\n5oh5jdHUNx8aNmdUiKZkGwMdrSklTOvm9SNCTWEgcJGsXrDNdX4Oz/iPNV/lNYeM\nODosXKxeriYQSgaEv+Q60sVs/PKanlDHoMlhaTpADlAezbQ9pVTKL7IUyi8pVsNG\nCKSTSR1VwYvcBqqyLJgxw946k9RS0aEPjVIrygcBRFqHeTap8H2RaWLRZJ7psuk5\nXY8cVLPldGVacW3H118SPmjuboBe0btDP30V7ZvdAlRHl24ykAaQEDNML5dzVYEh\n0RDt+hQaI2fHz03snqHS/IYfEzopuTwDforZV8/qbmIcDK9dy8DtevdShKxgMzWo\nyDCJpASHlZ8G1HMJ8/OCYMcvPcjLy5TQ4KRVyl/6F6d+RGTXFyz9UlXRZk5hS5Me\n9LngAbQxibB/IWI3FSmACUPd5Iev7ma9X9fSRKhbuHdeD7tsHofiZsl0caZupack\nVGc7DSIoz0s+gtYbNSOzfYL3h8oKstrCVkX8FixP4osjWuNrj2pyhcatyiMv2k2I\nZGctd2vTFK0H0nU8EOodrhLU/bv2g4aBWFbpHgsQPIz7zvuLYqfiYjhBp8f0KCrR\nbDuGwoDS1OL2hGJ0I4KwYDDOu2Fkezo2J1sGDLVbF9H+FgHgzY5V9CmsL7SrG34B\nq16deuwutnqo3KGeK2kGkhYhbvgBbNsOHkw6WveQga11mVlTCqzubceYl2z3PkR7\nVEhcFufm94uED+tb/xJUBtNCp4XB9UvGaPaNbwG9SAPxn/6u4rc5C3QcRwuoSIjv\nRpdLsS6w067dadQ2ejblbLe5OURjNkxoWSIJQFT7dwswPWKS64GI6YgUKF/H0oK7\nY+jF1IAI2p3wRkZLiBjUWTi9icCxLa0AJh14JFT1wds8CnvG7227pOPpDVZWd2eR\nbVHiw5qnVm6/Ib9CFgMsDn1YJJhE3I3WVkmy1mbNnoBn4Be2LUn0YltOhLpfsAlM\n-----END RSA PRIVATE KEY-----',
            passphrase: {
                ciphertext: 'YXMzYXMz',
                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                ignoreChanges: true
            }
        };
        const properties = [
            {
                name: 'certificates',
                inputValue: [
                    [
                        {
                            enabled: undefined,
                            certificate: 'webcert1'
                        },
                        {
                            enabled: undefined,
                            matchToSNI: 'www.wheeee.com',
                            certificate: 'webcert2',
                            sniDefault: true
                        }
                    ],
                    [
                        {
                            enabled: false,
                            certificate: 'webcert1',
                            proxyCertificate: 'proxyCert',
                            sniDefault: true
                        },
                        {
                            enabled: false,
                            matchToSNI: 'www.wheeee.com',
                            certificate: 'webcert2',
                            proxyCertificate: 'proxyCert'
                        }
                    ],
                    [
                        {
                            enabled: undefined,
                            certificate: 'webcert1',
                            sniDefault: true
                        },
                        {
                            enabled: undefined,
                            matchToSNI: 'www.wheeee.com',
                            certificate: 'webcert2'
                        }
                    ]
                ],
                expectedValue: [
                    [
                        {
                            name: getItemName({ tenantName: `TEST_${testName}` }),
                            cert: 'webcert1.crt',
                            key: 'webcert1.key',
                            certKeyChain: [
                                {
                                    name: 'set0',
                                    cert: 'webcert1.crt',
                                    key: 'webcert1.key',
                                    chain: 'none',
                                    usage: 'SERVER'
                                }
                            ],
                            mode: 'enabled',
                            serverName: 'none',
                            sniDefault: 'false'
                        },
                        {
                            name: `${getItemName({ tenantName: `TEST_${testName}` })}-1-`,
                            cert: 'webcert2.crt',
                            key: 'webcert2.key',
                            certKeyChain: [
                                {
                                    name: 'set0',
                                    cert: 'webcert2.crt',
                                    key: 'webcert2.key',
                                    chain: 'webcert2-bundle.crt',
                                    usage: 'SERVER'
                                }
                            ],
                            mode: 'enabled',
                            serverName: 'www.wheeee.com',
                            sniDefault: 'true'
                        }
                    ],
                    [
                        {
                            name: getItemName({ tenantName: `TEST_${testName}` }),
                            cert: 'webcert1.crt',
                            key: 'webcert1.key',
                            certKeyChain: [
                                {
                                    name: 'set0',
                                    cert: 'webcert1.crt',
                                    key: 'webcert1.key',
                                    chain: 'none',
                                    usage: 'SERVER'
                                },
                                {
                                    name: 'set1',
                                    cert: 'proxyCert.crt',
                                    key: 'proxyCert.key',
                                    chain: 'none',
                                    usage: 'CA'
                                }
                            ],
                            mode: 'disabled',
                            serverName: 'none',
                            sniDefault: 'true'
                        },
                        {
                            name: `${getItemName({ tenantName: `TEST_${testName}` })}-1-`,
                            cert: 'webcert2.crt',
                            key: 'webcert2.key',
                            certKeyChain: [
                                {
                                    name: 'set0',
                                    cert: 'webcert2.crt',
                                    key: 'webcert2.key',
                                    chain: 'webcert2-bundle.crt',
                                    usage: 'SERVER'
                                },
                                {
                                    name: 'set1',
                                    cert: 'proxyCert.crt',
                                    key: 'proxyCert.key',
                                    chain: 'none',
                                    usage: 'CA'
                                }
                            ],
                            mode: 'disabled',
                            serverName: 'www.wheeee.com',
                            sniDefault: 'false'
                        }
                    ],
                    [
                        {
                            name: getItemName({ tenantName: `TEST_${testName}` }),
                            cert: 'webcert1.crt',
                            key: 'webcert1.key',
                            certKeyChain: [
                                {
                                    name: 'set0',
                                    cert: 'webcert1.crt',
                                    key: 'webcert1.key',
                                    chain: 'none',
                                    usage: 'SERVER'
                                }
                            ],
                            mode: 'enabled',
                            serverName: 'none',
                            sniDefault: 'true'
                        },
                        {
                            name: `${getItemName({ tenantName: `TEST_${testName}` })}-1-`,
                            cert: 'webcert2.crt',
                            key: 'webcert2.key',
                            certKeyChain: [
                                {
                                    name: 'set0',
                                    cert: 'webcert2.crt',
                                    key: 'webcert2.key',
                                    chain: 'webcert2-bundle.crt',
                                    usage: 'SERVER'
                                }
                            ],
                            mode: 'enabled',
                            serverName: 'www.wheeee.com',
                            sniDefault: 'false'
                        }
                    ]
                ],
                referenceObjects: {
                    webcert1: certs.webcert1,
                    webcert2: certs.webcert2,
                    proxyCert
                },
                extractFunction: extractFunctions.certs
            },
            {
                name: 'forwardProxyEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: [
                    ['disabled', 'disabled'],
                    ['enabled', 'enabled'],
                    ['disabled', 'disabled']
                ],
                extractFunction: (o) => o.map((p) => p.sslForwardProxy)
            },
            {
                name: 'forwardProxyBypassEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: [
                    ['disabled', 'disabled'],
                    ['enabled', 'enabled'],
                    ['disabled', 'disabled']
                ],
                extractFunction: (o) => o.map((p) => p.sslForwardProxyBypass)
            },
            {
                name: 'forwardProxyBypassAllowlist',
                inputValue: [undefined, { use: 'dataGroupHostnames' }, undefined],
                expectedValue: [
                    ['disabled', 'disabled'],
                    ['enabled', 'enabled'],
                    ['disabled', 'disabled']
                ],
                referenceObjects: {
                    dataGroupHostnames: {
                        class: 'Data_Group',
                        storageType: 'internal',
                        name: 'internalHostnames',
                        keyDataType: 'string',
                        records: [
                            {
                                key: 'exampleKey',
                                value: 'example.com'
                            },
                            {
                                key: 'testKey',
                                value: 'home.edu'
                            }
                        ]
                    }
                },
                extractFunction: (o) => o.map((p) => p.sslForwardProxyBypass)
            },
            {
                name: 'cacheCertificateEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: [
                    ['disabled', 'disabled'],
                    ['enabled', 'enabled'],
                    ['disabled', 'disabled']
                ],
                extractFunction: (o) => o.map((p) => p.certLookupByIpaddrPort)
            }
        ];
        const options = {
            findAll: true
        };
        return assertTLSServerClass(properties, options);
    });

    it('proxy SSL', () => {
        const properties = [
            {
                name: 'certificates',
                inputValue: [[
                    {
                        certificate: 'testWebcert'
                    }
                ]],
                skipAssert: true,
                referenceObjects: {
                    testWebcert: certs.webcert1
                }
            },
            {
                name: 'proxySslEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'proxySslPassthroughEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            }
        ];

        if (!util.versionLessThan(getBigIpVersion(), '14.0')) {
            properties.push({
                name: 'insertEmptyFragmentsEnabled',
                inputValue: [true],
                skipAssert: true
            });
        }

        return assertTLSServerClass(properties);
    });

    it('DTLS options', () => {
        const checkEnabled = function (o, name) {
            // Later versions of BIG-IP sets the tmOptions as a string not an array
            const optionArray = (Array.isArray(o.tmOptions)) ? o.tmOptions : o.tmOptions.split(' ');
            return (optionArray.indexOf(name) >= 0 ? 'Enabled' : 'Disabled');
        };
        const properties = [
            {
                name: 'certificates',
                inputValue: [[
                    {
                        certificate: 'testWebcert'
                    }
                ]],
                skipAssert: true,
                referenceObjects: {
                    testWebcert: certs.webcert1
                }
            },
            {
                name: 'dtlsEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['Disabled', 'Enabled', 'Disabled'],
                extractFunction: (o) => checkEnabled(o, 'no-dtls')
            }
        ];

        if (!util.versionLessThan(getBigIpVersion(), '16.0')) {
            properties.push({
                name: 'dtls1_2Enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['Disabled', 'Enabled', 'Disabled'],
                extractFunction: (o) => checkEnabled(o, 'no-dtlsv1.2')
            });
        }

        return assertTLSServerClass(properties);
    });
});
