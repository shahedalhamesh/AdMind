<?php

/*
 * Default roles created for every new company.
 * Permission format: "<area>.<action>". "*" = everything, "clients.*" = every clients action.
 * The values are copied into roles.permissions (JSON) when a company is created,
 * so each company can later customize its own roles.
 */
return [
    'roles' => [
        'Owner' => ['*'],
        'Manager' => [
            'clients.*', 'tasks.*', 'content.*', 'campaigns.*',
            'approvals.*', 'reports.*', 'agents.run', 'users.view',
        ],
        'Employee' => [
            'clients.view', 'tasks.view', 'tasks.update', 'content.*',
            'campaigns.view', 'agents.run', 'reports.view',
        ],
        'Client' => [
            'content.view', 'approvals.respond', 'requests.create', 'reports.view',
        ],
    ],
];
