# Security policy

## Supported versions

Security fixes are applied to the latest release.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature rather than opening a public issue. Include the affected version, operating system, reproduction steps, and expected impact. Do not include private prompts, model outputs, or other personal information.

## Security model

KAIPAL Arena is designed to communicate only with a model runner on the same computer. It rejects non-loopback runner addresses, does not contain telemetry, and does not make cloud inference requests. A locally installed model and Ollama remain separate software and should be obtained from sources you trust.
