/**
 * Buyer dispute view and communication portal.
 *
 * Implements Step 4, Rules 3 & 5:
 * - Card titled "Your case" with status in StatusBadge and merchant's latest message
 * - "View as merchant" is a calm secondary link, only in demo
 * - Safe plain text message rendering (no HTML)
 */

import React, { useEffect, useState } from 'react';
import { Button, Money, Skeleton, StatusBadge } from '@signoff/ui';
import { useRouter } from '../router';
import { colors, retailTheme } from '../theme';
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
    } catch (err: unknown) {
      setReplyError(err instanceof Error ? err.message : 'Failed to send message.');
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
          ? 'Offer accepted. PayPal will process your settlement.'
          : 'Offer declined. The case continues in dispute review.'
      );
    } catch (err: unknown) {
      setOfferActionMsg(err instanceof Error ? err.message : 'Failed to respond to offer.');
    } finally {
      setRespondingOffer(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '720px', margin: '40px auto', padding: '0 16px' }}>
        <Skeleton width="100%" height="240px" />
      </div>
    );
  }

  if (errorMessage || !dispute) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 16px' }}>
        <div
          data-testid="portal-dispute-error-card"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: retailTheme.cardShadow,
            padding: '36px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '18px', color: retailTheme.ink, margin: '0 0 8px 0' }}>
            Case Not Found
          </h2>
          <p style={{ color: retailTheme.inkMuted, fontSize: '13px', margin: '0 0 20px 0' }}>
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
  const latestMerchantMsg = dispute.messages
    .filter(m => m.posted_by === 'SELLER')
    .slice(-1)[0];

  return (
    <div
      style={{
        backgroundColor: retailTheme.pageBg,
        minHeight: '100vh',
        padding: '36px 16px',
        fontFamily: retailTheme.fontFamily,
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Navigation and "View as merchant" secondary link */}
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
              color: retailTheme.inkMuted,
              cursor: 'pointer',
              fontSize: '13px',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            ← Back to Order {orderCode}
          </button>

          {/* Rule 5: View as merchant link is a calm secondary link, only in demo */}
          <a
            href={merchantDeepLink}
            data-testid="portal-view-as-merchant-link"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: retailTheme.inkMuted,
              fontSize: '13px',
              textDecoration: 'underline',
            }}
          >
            View as merchant ↗
          </a>
        </div>

        {/* Rule 3: Card titled "Your case" with StatusBadge and merchant's latest message */}
        <div
          data-testid="portal-dispute-card"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: retailTheme.cardShadow,
            padding: '28px',
            marginBottom: '24px',
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
              borderBottom: `1px solid ${retailTheme.borderSubtle}`,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  margin: 0,
                  color: retailTheme.ink,
                  fontFamily: retailTheme.serifFont,
                }}
              >
                Your case
              </h1>
              <div
                data-testid="portal-dispute-id"
                style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: retailTheme.inkMuted,
                  marginTop: '4px',
                }}
              >
                Case ID: {dispute.id} · Order: {dispute.order_code}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                <StatusBadge
                  verdict={dispute.status === 'RESOLVED' ? 'ALLOW' : 'NEEDS_APPROVAL'}
                  testId="portal-dispute-status-badge"
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: retailTheme.ink }}>
                  {dispute.status}
                </span>
              </div>
              <div style={{ marginTop: '4px', fontSize: '18px', fontWeight: 700, color: retailTheme.ink }}>
                <Money money={dispute.amount} testId="portal-dispute-amount" />
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: '13px',
              color: retailTheme.inkMuted,
              marginBottom: '20px',
            }}
          >
            Reason: <strong data-testid="portal-dispute-reason" style={{ color: retailTheme.ink }}>{dispute.reason}</strong> · Filed on {new Date(dispute.created_at).toLocaleDateString()}
          </div>

          {/* Merchant's latest message inside "Your case" card */}
          <div
            style={{
              backgroundColor: retailTheme.surfaceWarm,
              padding: '14px 16px',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            <div style={{ fontWeight: 600, color: retailTheme.ink, marginBottom: '4px' }}>
              Merchant&apos;s latest message:
            </div>
            <div style={{ color: retailTheme.inkMuted, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {latestMerchantMsg ? latestMerchantMsg.content : 'Awaiting merchant response.'}
            </div>
          </div>
        </div>

        {/* Settlement Offer Card (Scenario C) */}
        {dispute.offer && (
          <div
            data-testid="portal-offer-card"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              boxShadow: retailTheme.cardShadow,
              padding: '24px',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: retailTheme.ink }}>
                Merchant Settlement Offer
              </h3>
              <span
                data-testid="portal-offer-status"
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.brandPrimary,
                }}
              >
                {dispute.offer.status || 'PENDING'}
              </span>
            </div>

            <div style={{ fontSize: '16px', fontWeight: 700, color: retailTheme.ink, marginBottom: '8px' }}>
              <Money money={dispute.offer.amount} testId="portal-offer-amount" />
            </div>

            {dispute.offer.note && (
              <div style={{ fontSize: '13px', color: retailTheme.inkMuted, marginBottom: '16px' }}>
                &ldquo;{dispute.offer.note}&rdquo;
              </div>
            )}

            {offerActionMsg && (
              <div style={{ fontSize: '13px', fontWeight: 600, color: colors.brandPrimary, marginBottom: '12px' }}>
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
                  Accept Offer
                </Button>
                <Button
                  variant="secondary"
                  disabled={respondingOffer}
                  onClick={() => handleOfferResponse('DENY')}
                  testId="portal-deny-offer-btn"
                >
                  Decline
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Messages Thread (Scenario D) */}
        <div
          data-testid="portal-messages-container"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: retailTheme.cardShadow,
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <h3
            style={{
              margin: '0 0 16px 0',
              fontSize: '15px',
              fontWeight: 600,
              color: retailTheme.ink,
              borderBottom: `1px solid ${retailTheme.borderSubtle}`,
              paddingBottom: '12px',
            }}
          >
            Communication History
          </h3>

          {dispute.messages.length === 0 ? (
            <div style={{ color: retailTheme.inkMuted, fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
              No messages posted yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dispute.messages.map((msg, idx) => {
                const isBuyer = msg.posted_by === 'BUYER';
                return (
                  <div
                    key={idx}
                    data-testid={`portal-message-${idx}`}
                    style={{
                      backgroundColor: isBuyer ? retailTheme.surfaceWarm : '#FFFFFF',
                      border: `1px solid ${retailTheme.borderSubtle}`,
                      borderRadius: '6px',
                      padding: '12px 14px',
                      alignSelf: isBuyer ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '16px',
                        fontSize: '11px',
                        color: retailTheme.inkMuted,
                        marginBottom: '4px',
                      }}
                    >
                      <strong style={{ color: retailTheme.ink }}>
                        {isBuyer ? 'You' : 'Merchant'}
                      </strong>
                      <span>{new Date(msg.time_posted).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {/* Escaped plain text rendering — no HTML */}
                    <div
                      data-testid={`portal-message-content-${idx}`}
                      style={{
                        fontSize: '13px',
                        color: retailTheme.ink,
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

          {/* Reply Form */}
          <form onSubmit={handleSendReply} style={{ marginTop: '20px' }}>
            {replyError && (
              <div
                data-testid="portal-reply-error"
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#FEF2F2',
                  borderRadius: '6px',
                  color: '#991B1B',
                  fontSize: '12px',
                  marginBottom: '10px',
                }}
              >
                {replyError}
              </div>
            )}
            <textarea
              data-testid="portal-reply-textarea"
              rows={3}
              placeholder="Type a message to the merchant..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1px solid ${retailTheme.borderSubtle}`,
                fontSize: '13px',
                fontFamily: retailTheme.fontFamily,
                boxSizing: 'border-box',
                resize: 'vertical',
                marginBottom: '10px',
              }}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={sendingReply}
              testId="portal-send-reply-btn"
            >
              {sendingReply ? 'Sending…' : 'Send Message'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
