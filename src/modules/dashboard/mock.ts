import type {
  LifecycleState,
  Phase,
  RiskLevel,
} from '@/shared/components/primitives'

export interface MockProperty {
  id: string
  code: string
  name: string
  city: string
  lifecycle_state: LifecycleState
  phase_current: Phase | null
  region: string
  tech_owner: string
  csc: string
  salesforce_id: string | null
  ingauge_id: string | null
  start_date: string
  activation_date: string
  tasks_complete: number
  tasks_total: number
  ttv_data: number | null
  ttv_config: number | null
  ttv_prov: number | null
  ttv_overall: number | null
  risk: RiskLevel
}

export const MOCK_PROPERTIES: MockProperty[] = [
  {
    id: '1',
    code: 'PRP-0001',
    name: 'The Grand Meridian Miami',
    city: 'Miami, FL',
    lifecycle_state: 'onboarding',
    phase_current: 'data',
    region: 'Southeast',
    tech_owner: 'Jordan Lee',
    csc: 'Maria Santos',
    salesforce_id: null,
    ingauge_id: null,
    start_date: '2026-06-01',
    activation_date: '2026-07-30',
    tasks_complete: 2,
    tasks_total: 20,
    ttv_data: 78,
    ttv_config: null,
    ttv_prov: null,
    ttv_overall: 78,
    risk: 'medium',
  },
  {
    id: '2',
    code: 'PRP-0002',
    name: 'Palazzo Hotel & Suites',
    city: 'New York, NY',
    lifecycle_state: 'onboarding',
    phase_current: 'configuration',
    region: 'Northeast',
    tech_owner: 'Sam Okeke',
    csc: 'Jordan Lee',
    salesforce_id: 'SF-00291',
    ingauge_id: null,
    start_date: '2026-05-15',
    activation_date: '2026-07-15',
    tasks_complete: 8,
    tasks_total: 20,
    ttv_data: 91,
    ttv_config: 62,
    ttv_prov: null,
    ttv_overall: 74,
    risk: 'medium',
  },
  {
    id: '3',
    code: 'PRP-0003',
    name: 'Harborview Resort',
    city: 'Seattle, WA',
    lifecycle_state: 'onboarding',
    phase_current: 'provisioning',
    region: 'West Coast',
    tech_owner: 'Priya Nair',
    csc: 'Sam Okeke',
    salesforce_id: 'SF-00187',
    ingauge_id: 'IG-0041',
    start_date: '2026-04-10',
    activation_date: '2026-06-30',
    tasks_complete: 15,
    tasks_total: 20,
    ttv_data: 85,
    ttv_config: 79,
    ttv_prov: 41,
    ttv_overall: 68,
    risk: 'high',
  },
  {
    id: '4',
    code: 'PRP-0004',
    name: 'The Belmont Chicago',
    city: 'Chicago, IL',
    lifecycle_state: 'activated',
    phase_current: null,
    region: 'Midwest',
    tech_owner: 'Jordan Lee',
    csc: 'Priya Nair',
    salesforce_id: 'SF-00103',
    ingauge_id: 'IG-0022',
    start_date: '2026-02-01',
    activation_date: '2026-05-10',
    tasks_complete: 20,
    tasks_total: 20,
    ttv_data: 92,
    ttv_config: 88,
    ttv_prov: 85,
    ttv_overall: 89,
    risk: 'low',
  },
  {
    id: '5',
    code: 'PRP-0005',
    name: 'Coastal Inn San Diego',
    city: 'San Diego, CA',
    lifecycle_state: 'onboarding',
    phase_current: 'data',
    region: 'West Coast',
    tech_owner: 'Sam Okeke',
    csc: 'Jordan Lee',
    salesforce_id: null,
    ingauge_id: null,
    start_date: '2026-06-15',
    activation_date: '2026-08-15',
    tasks_complete: 1,
    tasks_total: 20,
    ttv_data: 45,
    ttv_config: null,
    ttv_prov: null,
    ttv_overall: 45,
    risk: 'critical',
  },
  {
    id: '6',
    code: 'PRP-0006',
    name: 'The Summit Denver',
    city: 'Denver, CO',
    lifecycle_state: 'onboarding',
    phase_current: 'data',
    region: 'Midwest',
    tech_owner: 'Priya Nair',
    csc: 'Maria Santos',
    salesforce_id: null,
    ingauge_id: null,
    start_date: '2026-06-20',
    activation_date: '2026-08-30',
    tasks_complete: 0,
    tasks_total: 20,
    ttv_data: 62,
    ttv_config: null,
    ttv_prov: null,
    ttv_overall: 62,
    risk: 'medium',
  },
]
