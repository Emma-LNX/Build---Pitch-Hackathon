package com.hackathon.mathportal.modules.accounts;

import com.hackathon.mathportal.modules.accounts.service.AuthProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(AuthProperties.class)
public class AccountsConfig {}
