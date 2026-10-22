/**
 * Buyer dispute view and communication portal.
 *
 * Implements Step 32:
 * - Dispute status, details, merchant messages and offers
 * - Buyer can reply with a message (Scenario D)
 * - Buyer can respond to an offer (Scenario C / S9)
 * - "View as merchant" deep link to the dispute in the Signoff dashboard
 * - Safe plain text rendering (no HTML markup evaluation)
 */

import React, { useEffect, useState } from 'react';
import { Button, Money, Skeleton } from '@signoff/ui';
import { useRouter } from '../router';
import { warmColors, warmShadows } from '../theme';
import { fetchOrderDisputeStatus, respondToOffer, sendBuyerMessage } from './portalApi';
import type { BuyerDisputeDetail } from './types';

export const BuyerDisputePage: React.FC<{ orderCode: string }> = ({ orderCode }) => {
  const { navigate } = useRouter();

  const [email] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const queryEmail = params.get('email');
      if (queryEmail) return queryEmail;
      return window.sessionStorage.getItem('buyer_portal_email') || 'alex.morgan@example.test';
    } catch {
      return 'alex.morgan@example.test';
    }
  });

  const [dispute, setDispute] = useState<BuyerDisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reply form state (Scenario D)
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Offer response state (S9)
  const [respondingOffer, setRespondingOffer] = useState(false);
  const [offerActionMsg, setOfferActionMsg] = useState<string | null>(null);

  const signoffBaseUrl = import.meta.env.PUBLIC_SIGNOFF_URL ?? '';

  const loadDispute = () => {
    setLoading(true);
    setErrorMessage(null);
    fetchOrderDisputeStatus(orderCode, email)
      .then(res => {
        if (res.dispute) {
          setDispute(res.dispute);
        } else {
          setErrorMessage('No active dispute found for this order.');
        }
        setLoading(false);
      })
      .catch(err => {
        setErrorMessage(err.message || 'Failed to load dispute details');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadDispute();
  }, [orderCode, email]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    setReplyError(null);

    const clean = replyText.trim();
    if (!clean) {
      setReplyError('Please enter a message before sending.');
      return;
    }

    setSendingReply(true);
    try {
      const updated = await sendBuyerMessage(orderCode, {
        customer_email: email,
        message: clean,
      });
      setDispute(updated);
      setReplyText('');
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSendingReply(false);
    }
  };

  const handleOfferResponse = async (action: 'ACCEPT' | 'DENY') => {
    setRespondingOffer(true);
    setOfferActionMsg(null);
    try {
      const updated = await respondToOffer(orderCode, {
        customer_email: email,
        action,
      });
      setDispute(updated);
      setOfferActionMsg(
        action === 'ACCEPT'
          ? 'You accepted the merchant offer. Dispute is now resolved.'
          : 'You declined the merchant offer. Status returned to merchant response.'
      );
    } catch (err) {
      setOfferActionMsg(err instanceof Error ? err.message : 'Failed to submit offer response');
    } finally {
      setRespondingOffer(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 16px' }}>
        <Skeleton width="100%" height="280px" />
      </div>
    );
  }

  if (errorMessage || !dispute) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 16px' }}>
        <div
          data-testid="portal-dispute-error-card"
          style={{
            backgroundColor: warmColors.surface,
            borderRadius: '16px',
            border: `1px solid ${warmColors.border}`,
            padding: '36px',
            textAlign: 'center',
            boxShadow: warmShadows.md,
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', color: warmColors.ink, margin: '0 0 8px 0' }}>
            Dispute Not Found
          </h2>
          <p style={{ color: warmColors.inkMuted, fontSize: '14px', margin: '0 0 24px 0' }}>
            {errorMessage || 'Could not find an active dispute for this order.'}
          </p>
          <Button
            variant="primary"
            onClick={() => navigate(`/orders/${orderCode}?email=${encodeURIComponent(email)}`)}
          >
            ← Return to Order
          </Button>
        </div>
      </div>
    );
  }

  const merchantDeepLink = `${signoffBaseUrl}/disputes/${encodeURIComponent(dispute.id)}`;

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 16px' }}>
      {/* Back button & View as merchant link */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(`/orders/${orderCode}?email=${encodeURIComponent(email)}`)}
          style={{
            background: 'none',
            border: 'none',
            color: warmColors.primary,
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            padding: 0,
          }}
        >
          ← Back to Order {orderCode}
        </button>

        {/* View as Merchant Deep Link */}
        <a
          href={merchantDeepLink}
          data-testid="portal-view-as-merchant-link"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#b45309', // Amber-700
            backgroundColor: '#fef3c7', // Amber-100
            border: '1px solid #fde68a',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          View as merchant in Signoff Dashboard ↗
        </a>
      </div>

      {/* Main Dispute Status Card */}
      <div
        data-testid="portal-dispute-card"
        style={{
          backgroundColor: warmColors.surface,
          borderRadius: '16px',
          border: `1px solid ${warmColors.border}`,
          boxShadow: warmShadows.sm,
          padding: '28px',
          marginBottom: '28px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '12px',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: `1px solid ${warmColors.borderMuted}`,
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: warmColors.inkMuted, textTransform: 'uppercase' }}>
              PayPal Dispute Case
            </div>
            <h1
              data-testid="portal-dispute-id"
              style={{ fontSize: '24px', fontWeight: 700, margin: '2px 0 0 0', color: warmColors.ink, fontFamily: 'monospace' }}
            >
              {dispute.id}
            </h1>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              data-testid="portal-dispute-status-badge"
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: dispute.status === 'RESOLVED' ? warmColors.successBg : '#fef3c7',
                color: dispute.status === 'RESOLVED' ? warmColors.successInk : '#92400e',
                border: `1px solid ${dispute.status === 'RESOLVED' ? warmColors.successBorder : '#fde68a'}`,
              }}
            >
              {dispute.status}
            </span>
            <div style={{ marginTop: '4px', fontSize: '18px', fontWeight: 700, color: warmColors.accent }}>
              <Money money={dispute.amount} testId="portal-dispute-amount" />
            </div>
          </div>
        </div>

        {/* Dispute Details Meta */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            fontSize: '13px',
          }}
        >
          <div>
            <span style={{ color: warmColors.inkMuted }}>Reason: </span>
            <strong data-testid="portal-dispute-reason">{dispute.reason}</strong>
          </div>
          <div>
            <span style={{ color: warmColors.inkMuted }}>Filed on: </span>
            <span>{new Date(dispute.created_at).toLocaleDateString()}</span>
          </div>
          <div>
            <span style={{ color: warmColors.inkMuted }}>Order: </span>
            <code style={{ fontFamily: 'monospace' }}>{dispute.order_code}</code>
          </div>
        </div>
      </div>

      {/* Merchant Settlement Offer Card (Scenario C / S9) */}
      {dispute.offer && (
        <div
          data-testid="portal-offer-card"
          style={{
            backgroundColor: '#f0fdf4', // Green-50
            border: '1px solid #bbf7d0', // Green-200
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '28px',
            boxShadow: warmShadows.sm,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#166534' }}>
              Merchant Settlement Offer
            </h3>
            <span
              data-testid="portal-offer-status"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: '#dcfce7',
                color: '#15803d',
              }}
            >
              {dispute.offer.status || 'PENDING'}
            </span>
          </div>

          <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#14532d' }}>
            The merchant has offered a refund of{' '}
            <strong>
              <Money money={dispute.offer.amount} testId="portal-offer-amount" />
            </strong>{' '}
            to settle this claim.
          </p>

          {dispute.offer.note && (
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #dcfce7',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#166534',
                marginBottom: '16px',
                fontStyle: 'italic',
              }}
            >
              &ldquo;{dispute.offer.note}&rdquo;
            </div>
          )}

          {offerActionMsg && (
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#15803d', marginBottom: '12px' }}>
              {offerActionMsg}
            </div>
          )}

          {dispute.offer.status !== 'ACCEPTED' && dispute.offer.status !== 'DENIED' && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="primary"
                disabled={respondingOffer}
                onClick={() => handleOfferResponse('ACCEPT')}
                testId="portal-accept-offer-btn"
              >
                Accept Offer ({dispute.offer.amount.currency_code} {dispute.offer.amount.value})
              </Button>
              <Button
                variant="secondary"
                disabled={respondingOffer}
                onClick={() => handleOfferResponse('DENY')}
                testId="portal-deny-offer-btn"
              >
                Decline Offer
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Messages Thread (Scenario D) */}
      <div
        data-testid="portal-messages-container"
        style={{
          backgroundColor: warmColors.surface,
          borderRadius: '16px',
          border: `1px solid ${warmColors.border}`,
          boxShadow: warmShadows.sm,
          padding: '28px',
          marginBottom: '28px',
        }}
      >
        <h3
          style={{
            margin: '0 0 16px 0',
            fontSize: '16px',
            fontWeight: 700,
            color: warmColors.ink,
            borderBottom: `1px solid ${warmColors.borderMuted}`,
            paddingBottom: '12px',
          }}
        >
          Case Communication History
        </h3>

        {dispute.messages.length === 0 ? (
          <div style={{ color: warmColors.inkMuted, fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
            No messages posted yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {dispute.messages.map((msg, idx) => {
              const isBuyer = msg.posted_by === 'BUYER';
              return (
                <div
                  key={idx}
                  data-testid={`portal-message-${idx}`}
                  style={{
                    backgroundColor: isBuyer ? '#f8fafc' : '#fffbeb',
                    border: `1px solid ${isBuyer ? '#e2e8f0' : '#fde68a'}`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    alignSelf: isBuyer ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '16px',
                      fontSize: '12px',
                      marginBottom: '6px',
                    }}
                  >
                    <strong style={{ color: isBuyer ? warmColors.primary : '#92400e' }}>
                      {isBuyer ? 'You (Buyer)' : 'Merchant (Seller)'}
                    </strong>
                    <span style={{ color: warmColors.inkMuted }}>
                      {new Date(msg.time_posted).toLocaleString()}
                    </span>
                  </div>
                  {/* Safely rendered as plain text data — no HTML interpretation */}
                  <div
                    data-testid={`portal-message-content-${idx}`}
                    style={{
                      fontSize: '14px',
                      color: warmColors.ink,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Reply input form */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: `1px solid ${warmColors.border}` }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: warmColors.ink }}>
            Reply to Merchant
          </h4>

          {replyError && (
            <div
              data-testid="portal-reply-error"
              style={{
                padding: '8px 12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#b91c1c',
                fontSize: '13px',
                marginBottom: '12px',
              }}
            >
              {replyError}
            </div>
          )}

          <form onSubmit={handleSendReply}>
            <textarea
              data-testid="portal-reply-textarea"
              rows={3}
              placeholder="Type your response to the merchant..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: `1px solid ${warmColors.border}`,
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                resize: 'vertical',
                marginBottom: '12px',
              }}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={sendingReply}
              testId="portal-send-reply-btn"
            >
              {sendingReply ? 'Sending...' : 'Send Reply Message →'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
