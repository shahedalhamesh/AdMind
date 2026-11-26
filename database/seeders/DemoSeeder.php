<?php

namespace Database\Seeders;

use App\Models\AiPolicy;
use App\Models\Client;
use App\Models\Company;
use App\Models\Plan;
use App\Models\Role;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Demo data (development only, every account uses the password "password"):
 *  - the platform admin (no company) and 3 plans,
 *  - "Demo Agency": the agency used in the demo, with the four roles, one user per role and 7 clients
 *    (Demo Client is always client 1: the AI policy and the Instagram account are set on it),
 *  - the AI policies (company default: assisted; Demo Client: autonomous with auto-publish) and the Instagram
 *    account of Demo Client (no real token here: the token stays in the .env, never in Git),
 *  - "Bright Media": a second agency with its own owner and client, to show that agencies never see each other's data,
 *  - 4 more agencies with a few users and clients each, so the platform admin's table of companies shows different plans and statuses.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        // Free stays plan 1 (the sign-up flow gives new agencies the free plan)
        $free = Plan::forceCreate([
            'name' => 'Free', 'slug' => 'free', 'price_monthly' => 0,
            'max_clients' => 3, 'max_users' => 5, 'max_agent_requests_per_day' => 50,
            'features' => [], 'is_active' => true,
        ]);
        $pro = Plan::forceCreate([
            'name' => 'Pro', 'slug' => 'pro', 'price_monthly' => 49,
            'max_clients' => 15, 'max_users' => 15, 'max_agent_requests_per_day' => 300,
            'features' => [], 'is_active' => true,
        ]);
        $agencyPlan = Plan::forceCreate([
            'name' => 'Agency', 'slug' => 'agency', 'price_monthly' => 149,
            'max_clients' => null, 'max_users' => null, 'max_agent_requests_per_day' => null, // unlimited
            'features' => [], 'is_active' => true,
        ]);

        // Platform Admin: no company
        User::forceCreate([
            'name' => 'Platform Admin', 'email' => 'admin@admind.test',
            'password' => 'password', 'status' => 'active',
        ]);

        // ---------- Demo Agency (company 1): the one shown in the demo ----------
        $demo = Company::forceCreate([
            'name' => 'Demo Agency', 'plan' => 'pro', 'plan_id' => $pro->id,
            'subscription_status' => 'active', 'features' => [],
            'business_goals' => 'Grow our clients\' social media presence and turn followers into customers.',
            'company_identity' => 'A friendly digital marketing agency for local businesses. We write in a warm, simple tone.',
        ]);
        $roles = $this->roles($demo);

        $clients = [];
        $rows = [
            // Demo Client must stay the first one (id 1)
            ['Demo Client', 'Cafe', 'Lina Haddad', 'lina@democlient.example.test', '+000 000 0001', 'More foot traffic and more followers on Instagram.', ['content', 'campaigns'], 'active'],
            ['Olive & Thyme', 'Restaurant', 'Omar Nasser', 'omar@oliveandthyme.example.test', '+000 000 0002', 'Fill the tables on weekdays and promote the new lunch menu.', ['content', 'campaigns'], 'active'],
            ['FitLab Gym', 'Fitness', 'Rania Khoury', 'rania@fitlab.example.test', '+000 000 0003', 'Sell more memberships before the new year.', ['content', 'campaigns'], 'active'],
            ['Bloom Boutique', 'Retail (flowers and gifts)', 'Dana Saleh', 'dana@bloom.example.test', '+000 000 0004', 'Grow online orders for holidays and birthdays.', ['content'], 'active'],
            ['Sama Dental Clinic', 'Healthcare', 'Dr. Yousef Aziz', 'yousef@samadental.example.test', '+000 000 0005', 'Build trust and bring in new patients.', ['content'], 'active'],
            ['Urban Threads', 'Fashion', 'Maya Farouk', 'maya@urbanthreads.example.test', '+000 000 0006', 'Launch the spring collection.', ['content', 'campaigns'], 'paused'],
            ['Golden Dunes Travel', 'Travel', 'Karim Jaber', 'karim@goldendunes.example.test', '+000 000 0007', 'Promote summer packages.', ['campaigns'], 'churned'],
        ];
        foreach ($rows as [$name, $industry, $contact, $email, $phone, $goals, $services, $status]) {
            $clients[] = Client::forceCreate([
                'company_id' => $demo->id, 'name' => $name, 'industry' => $industry,
                'contact_name' => $contact, 'contact_email' => $email, 'contact_phone' => $phone,
                'goals' => $goals, 'agreed_services' => $services, 'status' => $status,
            ]);
        }
        $demoClient = $clients[0];

        $accounts = [
            ['Owner', 'Demo Owner', 'owner@demo.test', null],
            ['Manager', 'Demo Manager', 'manager@demo.test', null],
            ['Employee', 'Demo Employee', 'employee@demo.test', null],
            ['Client', 'Demo Client User', 'client@demo.test', $demoClient->id],
        ];
        $users = [];
        foreach ($accounts as [$role, $name, $email, $clientId]) {
            $users[$role] = User::forceCreate([
                'company_id' => $demo->id, 'role_id' => $roles[$role]->id,
                'client_id' => $clientId, 'name' => $name, 'email' => $email,
                'password' => 'password', 'status' => 'active',
            ]);
        }

        // the employee is responsible for the first clients
        foreach (array_slice($clients, 0, 4) as $client) {
            $client->forceFill(['responsible_user_id' => $users['Employee']->id])->save();
        }

        // ---------- AI policies ----------
        // company default: the AI suggests, people approve (internal review first)
        AiPolicy::forceCreate([
            'company_id' => $demo->id, 'client_id' => null, 'autonomy_level' => 'assisted', 'max_spend' => 500,
            'approval_rules' => ['require_internal_review' => true],
            'publish_rules' => ['auto_publish' => false, 'allowed_platforms' => ['instagram']],
        ]);
        // Demo Client: autonomous, an approved post is published by itself (needs PUBLISH_PROVIDER=simulation or meta)
        AiPolicy::forceCreate([
            'company_id' => $demo->id, 'client_id' => $demoClient->id, 'autonomy_level' => 'autonomous', 'max_spend' => null,
            'approval_rules' => [],
            'publish_rules' => ['auto_publish' => true, 'allowed_platforms' => ['instagram']],
        ]);

        // ---------- Instagram account of Demo Client ----------
        // The name is only a label shown in the app. With PUBLISH_PROVIDER=meta the post goes to the Instagram account
        // of META_IG_USER_ID in the .env, so put the handle of that account here.
        SocialAccount::forceCreate([
            'company_id' => $demo->id, 'client_id' => $demoClient->id, 'platform' => 'instagram',
            'account_name' => 'nafas_sh8855',
            'access_token' => 'set-in-env', // placeholder: the real token is META_IG_ACCESS_TOKEN in the .env
            'status' => 'connected',
        ]);

        // ---------- Bright Media: a second agency (for the isolation demo) ----------
        $bright = Company::forceCreate([
            'name' => 'Bright Media', 'plan' => 'agency', 'plan_id' => $agencyPlan->id,
            'subscription_status' => 'active', 'features' => [],
            'business_goals' => 'Performance marketing for e-commerce brands.',
            'company_identity' => 'A data-driven agency. Direct and professional tone.',
        ]);
        $brightRoles = $this->roles($bright);
        Client::forceCreate([
            'company_id' => $bright->id, 'name' => 'Nova Fitness Store', 'industry' => 'E-commerce',
            'contact_name' => 'Sam Ortiz', 'contact_email' => 'sam@novafitness.example.test', 'contact_phone' => '+000 000 0101',
            'goals' => 'Lower the cost of acquiring a customer.', 'agreed_services' => ['content', 'campaigns'], 'status' => 'active',
        ]);
        User::forceCreate([
            'company_id' => $bright->id, 'role_id' => $brightRoles['Owner']->id, 'client_id' => null,
            'name' => 'Bright Owner', 'email' => 'owner@brightmedia.test', 'password' => 'password', 'status' => 'active',
        ]);

        // ---------- more agencies, so the platform admin's table is not empty ----------
        // [name, plan name, plan, status, ends at, owner email, extra staff [role, name, email], clients [name, industry, contact, status]]
        $others = [
            ['Pixel & Co', 'pro', $pro, 'trial', now()->addDays(10), 'owner@pixelco.test',
                [['Employee', 'Pixel Designer', 'designer@pixelco.test']],
                [['Aroma Coffee Roasters', 'Cafe', 'Nadia Fares', 'active'], ['Vista Optics', 'Retail', 'Hadi Mansour', 'active']]],
            ['Lumen Creative', 'pro', $pro, 'active', null, 'owner@lumen.test',
                [['Manager', 'Lumen Manager', 'manager@lumen.test'], ['Employee', 'Lumen Writer', 'writer@lumen.test']],
                [['Cedar Home Furniture', 'Furniture', 'Tariq Awad', 'active'], ['Pulse Fitness Club', 'Fitness', 'Salma Idris', 'active'], ['Noor Bakery', 'Food', 'Yara Mustafa', 'paused']]],
            ['Orbit Digital', 'free', $free, 'suspended', null, 'owner@orbit.test',
                [],
                [['Zest Juice Bar', 'Food and drink', 'Ali Barakat', 'active']]],
            ['Sand Marketing', 'free', $free, 'cancelled', now()->subDays(20), 'owner@sandmarketing.test',
                [['Employee', 'Sand Employee', 'staff@sandmarketing.test']],
                [['Oasis Spa', 'Wellness', 'Lama Rizk', 'churned'], ['Dune Auto Care', 'Automotive', 'Faris Nabil', 'churned']]],
        ];
        foreach ($others as [$name, $planName, $plan, $status, $ends, $ownerEmail, $staff, $theirClients]) {
            $company = Company::forceCreate([
                'name' => $name, 'plan' => $planName, 'plan_id' => $plan->id,
                'subscription_status' => $status, 'subscription_ends_at' => $ends, 'features' => [],
            ]);
            $companyRoles = $this->roles($company);

            User::forceCreate([
                'company_id' => $company->id, 'role_id' => $companyRoles['Owner']->id, 'client_id' => null,
                'name' => $name.' Owner', 'email' => $ownerEmail, 'password' => 'password', 'status' => 'active',
            ]);
            foreach ($staff as [$role, $staffName, $staffEmail]) {
                User::forceCreate([
                    'company_id' => $company->id, 'role_id' => $companyRoles[$role]->id, 'client_id' => null,
                    'name' => $staffName, 'email' => $staffEmail, 'password' => 'password', 'status' => 'active',
                ]);
            }
            foreach ($theirClients as [$clientName, $industry, $contact, $clientStatus]) {
                Client::forceCreate([
                    'company_id' => $company->id, 'name' => $clientName, 'industry' => $industry,
                    'contact_name' => $contact, 'goals' => 'Grow the brand on social media.',
                    'agreed_services' => ['content'], 'status' => $clientStatus,
                ]);
            }
        }
    }

    /** The four roles of an agency, from config/permissions.php. */
    private function roles(Company $company): array
    {
        $roles = [];
        foreach (config('permissions.roles') as $name => $permissions) {
            $roles[$name] = Role::forceCreate([
                'company_id' => $company->id, 'name' => $name, 'permissions' => $permissions,
            ]);
        }

        return $roles;
    }
}
