import { useState, useEffect } from 'react';
import { Mail, MessageSquare, MapPin, Send, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactInfo, setContactInfo] = useState({
    email_title: 'Email Us',
    email_address: 'support@guessit.com',
    location_title: 'Location',
    location_address: 'San Francisco, CA'
  });

  useEffect(() => {
    const fetchContactInfo = async () => {
      try {
        const res = await fetch(`${API_URL}/api/contact-settings`);
        if (res.ok) {
          const data = await res.json();
          setContactInfo(data);
        }
      } catch (err) {
        console.error('Failed to fetch contact settings:', err);
      }
    };
    fetchContactInfo();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setFormData({ name: '', email: '', subject: '', message: '' });
        }, 4000);
      }
    } catch (err) {
      console.error('Contact submit failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactMethods = [
    {
      icon: Mail,
      title: contactInfo.email_title,
      description: 'Send us an email anytime',
      value: contactInfo.email_address,
      link: `mailto:${contactInfo.email_address}`
    },
    {
      icon: MessageSquare,
      title: 'Live Chat',
      description: 'Chat with our support team',
      value: 'Available 24/7',
      link: '#'
    },
    {
      icon: MapPin,
      title: contactInfo.location_title,
      description: 'Visit our office',
      value: contactInfo.location_address,
      link: '#'
    }
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="contact-page">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/20 via-background to-background border-b border-border">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Get in <span className="text-primary">Touch</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Have questions, feedback, or need support? We're here to help!
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Send Us a Message</h2>
            {submitted ? (
              <div className="p-8 rounded-2xl border border-primary bg-primary/5 text-center" data-testid="contact-success">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-bold text-foreground mb-2">Message Sent!</h3>
                <p className="text-muted-foreground">We'll get back to you as soon as possible.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" data-testid="contact-form">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Name *</label>
                  <Input 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Your full name"
                    className="h-11"
                    data-testid="contact-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Email *</label>
                  <Input 
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="your@email.com"
                    className="h-11"
                    data-testid="contact-email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Subject *</label>
                  <Input 
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData(p => ({ ...p, subject: e.target.value }))}
                    placeholder="What's this about?"
                    className="h-11"
                    data-testid="contact-subject"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Message *</label>
                  <Textarea 
                    required
                    value={formData.message}
                    onChange={(e) => setFormData(p => ({ ...p, message: e.target.value }))}
                    placeholder="Tell us more..."
                    rows={6}
                    className="resize-none"
                    data-testid="contact-message"
                  />
                </div>
                <Button type="submit" size="lg" className="w-full gap-2" disabled={isSubmitting} data-testid="contact-submit">
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            )}
          </div>

          {/* Contact Methods */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Other Ways to Reach Us</h2>
            <div className="space-y-6">
              {contactMethods.map((method, idx) => {
                const Icon = method.icon;
                return (
                  <a
                    key={idx}
                    href={method.link}
                    className="block p-6 rounded-2xl border border-border bg-card hover:bg-card/80 hover:border-primary/50 transition-all duration-300"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-foreground mb-1">{method.title}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{method.description}</p>
                        <p className="text-sm font-semibold text-primary">{method.value}</p>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
