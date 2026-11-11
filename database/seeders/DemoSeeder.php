<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\Company;
use App\Models\Plan;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Demo data: one platform admin + one agency with the four roles and one user per role.
 * Every account uses the password "password" (development only).
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $plan = Plan::forceCreate([
            'name' => 'Free', 'slug' => 'free', 'price_monthly' => 0,
            'max_clients' => 3, 'max_users' => 5, 'max_agent_requests_per_day' => 50,
            'features' => [], 'is_active' => true,
        ]);

        // Platform Admin: no company
        User::forceCreate([
            'name' => 'Platform Admin', 'email' => 'admin@admind.test',
            'password' => 'password', 'status' => 'active',
        ]);

        $company = Company::forceCreate([
            'name' => 'Demo Agency', 'plan' => 'free', 'plan_id' => $plan->id,
            'subscription_status' => 'trial', 'features' => [],
        ]);

        $roles = [];
        foreach (config('permissions.roles') as $name => $permissions) {
            $roles[$name] = Role::forceCreate([
                'company_id' => $company->id, 'name' => $name, 'permissions' => $permissions,
            ]);
        }

        $client = Client::forceCreate([
            'company_id' => $company->id, 'name' => 'Demo Client', 'industry' => 'Cafe',
            'agreed_services' => ['content', 'campaigns'], 'status' => 'active',
        ]);

        $accounts = [
            ['Owner', 'Demo Owner', 'owner@demo.test', null],
            ['Manager', 'Demo Manager', 'manager@demo.test', null],
            ['Employee', 'Demo Employee', 'employee@demo.test', null],
            ['Client', 'Demo Client User', 'client@demo.test', $client->id],
        ];

        foreach ($accounts as [$role, $name, $email, $clientId]) {
            User::forceCreate([
                'company_id' => $company->id, 'role_id' => $roles[$role]->id,
                'client_id' => $clientId, 'name' => $name, 'email' => $email,
                'password' => 'password', 'status' => 'active',
            ]);
        }
    }
}
