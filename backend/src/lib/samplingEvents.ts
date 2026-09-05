import { publishToCentrifugo } from './centrifugo';
import { sendNotificationToUser } from './webpush';
import { db } from './db';

async function pushToCompanies(companyIds: string[], title: string, message: string, url = '/') {
  await db();
  const { User } = await import('@/models/User');
  const uniqueIds = [...new Set(companyIds.filter(Boolean))];

  await publishToCentrifugo('global_updates', {
    type: 'db_change',
    eventType: title,
    targetCompanyIds: uniqueIds,
    message,
  });

  const users = (await User.find({ companyId: { $in: uniqueIds } }).lean()) as any[];
  await Promise.all(
    users.map((user) =>
      sendNotificationToUser(user._id.toString(), {
        title: 'Sampling Update',
        body: message,
        url,
      })
    )
  );
}

export async function broadcastSamplingStarted(
  buyerCompanyId: string,
  supplierCompanyIds: string[],
  rfqNumber: string,
  sampleDeadlineAt?: Date | string
) {
  const deadlineText = sampleDeadlineAt
    ? ` Ready by ${new Date(sampleDeadlineAt).toLocaleString()}.`
    : '';
  const message = `Sampling started for RFQ ${rfqNumber}.${deadlineText} Prepare your physical sample — platform team will pick up and deliver.`;
  await pushToCompanies([buyerCompanyId, ...supplierCompanyIds], 'sampling_started', message, '/dashboard/rfqs');
}

export async function broadcastSampleSubmitted(
  buyerCompanyId: string,
  supplierName: string,
  rfqNumber: string
) {
  await pushToCompanies(
    [buyerCompanyId],
    'sample_submitted',
    `${supplierName} submitted a sample for RFQ ${rfqNumber}.`,
    '/dashboard/rfqs'
  );
  await publishToCentrifugo('global_updates', {
    type: 'db_change',
    eventType: 'sample_ready_for_pickup',
    target: 'all',
    message: `Sample ready for platform pickup — RFQ ${rfqNumber} (${supplierName}).`,
  });
}

export async function broadcastSampleDelivered(
  buyerCompanyId: string,
  supplierCompanyId: string,
  rfqNumber: string
) {
  const message = `Sample delivered for RFQ ${rfqNumber}. Review samples and select a winner.`;
  await pushToCompanies([buyerCompanyId, supplierCompanyId], 'sample_delivered', message, '/dashboard/rfqs');
}

export async function broadcastSamplePickedUp(
  buyerCompanyId: string,
  supplierCompanyId: string,
  supplierName: string,
  rfqNumber: string,
  deliveryNumber: string
) {
  const message = `${supplierName} sample picked up (${deliveryNumber}) for RFQ ${rfqNumber}. In transit to buyer.`;
  await pushToCompanies(
    [buyerCompanyId, supplierCompanyId],
    'sample_picked_up',
    message,
    '/dashboard/rfqs'
  );
}

export async function broadcastSamplingWinnerSelected(
  buyerCompanyId: string,
  winnerSupplierCompanyId: string,
  loserSupplierCompanyIds: string[],
  rfqNumber: string
) {
  await pushToCompanies(
    [winnerSupplierCompanyId],
    'sampling_winner_selected',
    `Your sample was selected for RFQ ${rfqNumber}. Purchase order created.`,
    '/dashboard/orders'
  );
  if (loserSupplierCompanyIds.length) {
    await pushToCompanies(
      loserSupplierCompanyIds,
      'sampling_winner_selected',
      `Another supplier was selected for RFQ ${rfqNumber}.`,
      '/dashboard/rfqs'
    );
  }
  await pushToCompanies(
    [buyerCompanyId],
    'sampling_winner_selected',
    `Winner selected for RFQ ${rfqNumber}. Order flow continues.`,
    '/dashboard/orders'
  );
}

export async function broadcastSamplingCancelled(
  buyerCompanyId: string,
  supplierCompanyIds: string[],
  rfqNumber: string
) {
  const message = `Sampling was cancelled for RFQ ${rfqNumber}.`;
  await pushToCompanies(
    [buyerCompanyId, ...supplierCompanyIds],
    'sampling_cancelled',
    message,
    '/dashboard/rfqs'
  );
}
