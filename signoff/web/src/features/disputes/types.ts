import type { components } from '@signoff/api-client/generated';
import type { TimelineEvent } from '@signoff/api-client';

export type DisputeDetail = components['schemas']['DisputeDetailResponse'];
export type DisputeListItem = components['schemas']['DisputeListItem'];
export type ApiTimelineEvent = components['schemas']['TimelineResponse']['items'][number];
export type { TimelineEvent };
