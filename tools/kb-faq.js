/* Phase 1 (b): the authored FAQ layer.

   Two sources feed this file:
     1. Finance Square's own positioning, taken from the site copy and the
        approved campaign documents.
     2. The questions Australian borrowers actually ask, checked against
        Westpac / NAB / ANZ / Macquarie first-home and refinance hubs for
        PHRASING, and against ASIC MoneySmart, APRA and Housing Australia
        for FACTS. Answers are written from scratch in Finance Square's
        voice - no lender copy is reproduced.

   Rules every answer here follows:
     · No rate, fee or approval is ever promised. Lending is "usually",
       "typically", "depends on the lender".
     · Anything that changes yearly (duty thresholds, scheme caps, tax
       rates) is described by MECHANISM, not by a number that will rot.
     · Every answer ends pointing at a human, because a broker conversation
       is the actual product.

   Fields: q (canonical question), a (answer), alt (other phrasings that
   should hit this entry), tags (retrieval keywords), topic, url (deep link). */

module.exports = [

  /* ============================================================
     A. Finance Square: who we are, how we work
     ============================================================ */
  {
    q: 'What does Finance Square Group do?',
    alt: ['who are you', 'what do you do', 'what is finance square', 'tell me about finance square'],
    topic: 'about',
    url: '/about.html',
    tags: ['about', 'company', 'broker', 'services', 'what', 'do'],
    a: 'Finance Square Group is a strategy-first finance broking firm based in Melbourne, working with clients right across Australia. We arrange home loans, refinancing, first home buyer finance, business and commercial lending, asset and equipment finance, and personal loans. Rather than pushing one lender\'s product, we look at your whole position first and then match it to lenders whose policies actually fit it.'
  },
  {
    q: 'Is your service free?',
    alt: ['do you charge', 'what does it cost to use a broker', 'broker fees', 'how much do you charge', 'is there a fee'],
    topic: 'about',
    tags: ['free', 'cost', 'fee', 'charge', 'price', 'commission', 'pay'],
    a: 'Our service to you is free, but other fees and lender charges may apply. In most cases a broker is paid a commission by the lender once your loan settles, not by you. If a situation ever did call for a fee, we would tell you in writing before you committed to anything.'
  },
  {
    q: 'Which lenders do you work with?',
    alt: ['what banks do you use', 'what lenders do you use', 'which lenders do you use',
      'do you use the big four', 'panel of lenders', 'how many lenders', 'what lenders are on your panel'],
    topic: 'about',
    tags: ['lenders', 'banks', 'panel', 'which', 'who', 'big four', 'options'],
    a: 'We work across a broad panel that includes the major banks, second-tier and regional lenders, non-bank lenders and specialist funders. That range matters most when your situation is not a straight PAYG payslip: the lender that says no and the lender that says yes are often looking at exactly the same numbers under different policies. We will tell you which lenders suit your file and why.'
  },
  {
    q: 'How is a broker different from just going to my bank?',
    alt: ['why use a broker', 'broker vs bank', 'should i go direct to the bank', 'what is the point of a broker'],
    topic: 'about',
    tags: ['broker', 'bank', 'versus', 'difference', 'why', 'direct'],
    a: 'Your bank can only offer you its own products, assessed under its own policy. If you do not fit that policy, the answer is no and the conversation ends there. We compare options across multiple lenders and government schemes, so a no from one lender is just information that points us at the right one. We also handle the paperwork, the follow-up and the lender chasing.'
  },
  {
    q: 'Where are you based and do you work outside Melbourne?',
    alt: ['where are you located', 'do you work in sydney', 'are you australia wide', 'what areas do you cover'],
    topic: 'about',
    tags: ['location', 'melbourne', 'australia', 'where', 'based', 'area', 'remote'],
    a: 'We are based in Melbourne and work with clients Australia-wide. Almost everything can be handled by phone, video and secure document upload, so where you live is rarely a constraint. State-specific things like stamp duty and first home buyer concessions are handled according to the state you are buying in.'
  },
  {
    q: 'Who is Priya Dey?',
    alt: ['who is my broker', 'who will i talk to', 'about priya', 'who runs finance square'],
    topic: 'about',
    url: '/about.html',
    tags: ['priya', 'dey', 'broker', 'who', 'founder', 'credit representative'],
    a: 'Priya Dey is the founder of Finance Square Group and the broker you will deal with. She is Credit Representative 543438 of BLSSA Pty Ltd, Australian Credit Licence 391237. Her approach is to start with what you are trying to build rather than with what you can borrow, then work the finance around that.'
  },
  {
    q: 'How do I get in touch or book a call?',
    alt: ['contact', 'phone number', 'email', 'book a call', 'speak to someone', 'talk to a human', 'call me'],
    topic: 'contact',
    url: '/contact.html',
    tags: ['contact', 'call', 'phone', 'email', 'book', 'appointment', 'human', 'speak'],
    a: 'The quickest way is to book a free 15-minute strategy call. I can set that up for you right here in this chat, or you can use the contact form. There is no cost and no obligation, and you will come away knowing what is realistic for your situation.'
  },

  /* ============================================================
     B. First home buyers
     ============================================================ */
  {
    q: 'How much deposit do I need to buy a home?',
    alt: ['do i need a 20% deposit', 'minimum deposit', 'how much do i need saved', 'deposit required'],
    topic: 'fhb',
    url: '/first-home-buyers.html',
    tags: ['deposit', 'savings', '20%', '5%', 'how much', 'minimum', 'lvr'],
    a: 'A 20% deposit is the level at which Lenders Mortgage Insurance normally stops applying, but it is not a requirement to buy. Plenty of lenders will lend with 10%, and some with as little as 5%, with LMI on top. Eligible first home buyers can also use the federal government\'s low-deposit guarantee, which supports a purchase with around a 5% deposit and no LMI. On top of the deposit you need cash for stamp duty, legals and other acquisition costs, which is why the honest answer is always specific to your state and price point.'
  },
  {
    q: 'What is LMI and can I avoid it?',
    alt: ['lenders mortgage insurance', 'what is lmi', 'how do i avoid lmi', 'lmi cost', 'is lmi worth it'],
    topic: 'costs',
    tags: ['lmi', 'mortgage insurance', 'lenders mortgage insurance', 'avoid', '80%', 'lvr', 'insurance'],
    a: 'Lenders Mortgage Insurance protects the lender, not you, if a loan with a smaller deposit goes bad. It usually applies once you borrow more than 80% of the property value, and the premium rises steeply as your loan-to-value ratio climbs, typically somewhere between about 1% and 5% of the loan. It is normally capitalised, meaning it gets added to the loan rather than paid in cash. Ways around it: get to a 20% deposit, use an eligible government guarantee, use a family guarantor, or check whether your profession qualifies for a waiver, which some lenders offer to doctors, lawyers, accountants and a few other groups. I can estimate your LMI on the numbers you give me.'
  },
  {
    q: 'What government schemes can help me buy my first home?',
    alt: ['first home guarantee', 'first home owner grant', '5% deposit scheme', 'government help first home', 'fhog', 'home guarantee scheme'],
    topic: 'fhb',
    url: '/first-home-buyers.html',
    tags: ['scheme', 'government', 'grant', 'guarantee', 'fhog', 'first home', 'help', '5%'],
    a: 'There are three separate things people mix up. First, the federal low-deposit guarantee, currently run as the government\'s 5% deposit scheme, which lets eligible first home buyers purchase with about a 5% deposit without paying LMI, and single parents with less again. Second, the First Home Owner Grant, a cash grant run by each state and usually limited to new builds. Third, state stamp duty concessions or exemptions for first home buyers, which are the biggest saving for most people. Eligibility rules, property price caps and thresholds differ by state and are changed regularly, so I will not quote you a cap that might be out of date. Tell me your state and rough price and we will work through which of the three you are likely to qualify for.'
  },
  {
    q: 'Will checking my borrowing power hurt my credit score?',
    alt: ['does a broker check hurt my credit', 'credit check', 'will this affect my credit score', 'credit enquiry'],
    topic: 'credit',
    tags: ['credit', 'score', 'check', 'enquiry', 'hurt', 'affect', 'rating'],
    a: 'No. Working out your borrowing power, running the numbers with me or getting your Finance Square Score does not involve a credit check. A formal credit enquiry is only made once you decide to move forward with an actual application, and we tell you before that happens. That is one reason to talk to a broker early rather than applying to three banks and collecting three enquiries.'
  },
  {
    q: 'Can I buy with a guarantor or help from my parents?',
    alt: ['guarantor loan', 'parents helping with deposit', 'family guarantee', 'gifted deposit', 'bank of mum and dad'],
    topic: 'fhb',
    tags: ['guarantor', 'parents', 'family', 'gift', 'deposit', 'help', 'security'],
    a: 'Yes, and it is common. There are two different things here. A gifted deposit is cash from family, which most lenders accept with a letter confirming it is a gift and not a loan. A family guarantee is where a parent puts up equity in their own property as additional security, which can remove LMI entirely and sometimes lets you buy with little or no deposit of your own. A guarantee is a real legal obligation for the guarantor, so it needs to be set up properly and understood by everyone. We can walk your family through it.'
  },
  {
    q: 'I am on a casual contract or a visa. Can I still get a loan?',
    alt: ['casual income home loan', 'visa home loan', 'temporary resident mortgage', 'part time income', 'new job home loan', 'probation'],
    topic: 'income',
    tags: ['casual', 'visa', 'contract', 'temporary', 'part time', 'probation', 'new job', 'resident'],
    a: 'Often yes. Lender policies vary a lot here, which is exactly where a broker earns their keep. Many lenders accept casual income after six to twelve months with the same employer, some accept it sooner. Contract and fixed-term income is widely accepted if there is a history or a renewal pattern. Probation is fine with some lenders and a hard no with others. Temporary residents can borrow with some lenders, usually at a lower loan-to-value ratio and sometimes needing FIRB approval. None of these situations rules you out automatically, they just narrow which lenders to approach.'
  },

  /* ============================================================
     C. Borrowing power and serviceability
     ============================================================ */
  {
    q: 'How much can I borrow?',
    alt: ['borrowing power', 'borrowing capacity', 'how much can i get', 'what can i afford', 'max loan'],
    topic: 'calculator',
    url: '/calculators.html#borrowing',
    tags: ['borrow', 'borrowing', 'capacity', 'power', 'afford', 'how much', 'maximum'],
    a: 'That comes down to your income after tax, your living expenses, any existing commitments, and the rate the lender assesses you at. I can estimate it right now if you tell me your annual income before tax, your rough monthly living expenses and any card limits or loan repayments you have.'
  },
  {
    q: 'Why do lenders assess me at a higher rate than the actual rate?',
    alt: ['serviceability buffer', 'assessment rate', 'apra buffer', 'stress test', 'why 3% higher'],
    topic: 'serviceability',
    tags: ['buffer', 'assessment', 'apra', 'serviceability', 'stress', 'rate', 'assess'],
    a: 'APRA requires lenders to check that you could still meet repayments if rates rose, so they assess your application at roughly three percentage points above the actual product rate. On a 6% loan you are being tested at about 9%. It is the single biggest reason borrowing power feels lower than people expect, and it is also why paying down or closing unused credit limits before you apply can make a real difference. Our borrowing calculator applies the same buffer, so the number it gives you is closer to what a lender will actually say.'
  },
  {
    q: 'Do my credit cards affect how much I can borrow?',
    alt: ['credit card limit borrowing power', 'do i need to close my credit cards', 'buy now pay later home loan', 'afterpay mortgage', 'hecs help debt home loan'],
    topic: 'serviceability',
    tags: ['credit card', 'limit', 'afterpay', 'bnpl', 'hecs', 'help debt', 'debt', 'close', 'commitments'],
    a: 'Yes, and more than most people expect. A credit card is assessed on its limit, not your balance, at roughly 3.8% of the limit per month. A $20,000 limit you never use is treated as about $760 a month of commitment, which can cost you well over $100,000 of borrowing power. Buy-now-pay-later accounts and personal loans are counted too, and a HECS or HELP debt reduces your assessable income while it is being repaid. Reducing or closing unused limits is usually the fastest single lever on borrowing power.'
  },
  {
    q: 'What are HEM and living expenses?',
    alt: ['hem benchmark', 'living expenses home loan', 'do lenders check my spending', 'expenses assessment'],
    topic: 'serviceability',
    tags: ['hem', 'expenses', 'living', 'spending', 'benchmark', 'household'],
    a: 'Lenders do not simply take your word on what you spend. They compare your declared living expenses against a benchmark for a household of your size and income, commonly called HEM, and use whichever is higher. So understating your spending does not help. What does help is having clean, explainable statements for the three months before you apply. Our borrowing calculator applies the same benchmark floor.'
  },
  {
    q: 'What is a pre-approval and do I need one?',
    alt: ['pre approval', 'conditional approval', 'how long does pre approval last', 'should i get pre approved'],
    topic: 'process',
    tags: ['pre-approval', 'preapproval', 'conditional', 'approval', 'auction', 'offer'],
    a: 'A pre-approval is a lender\'s conditional indication of what it would lend you, based on your verified income and expenses but before any specific property is assessed. It usually lasts around three months and can be extended. It is genuinely useful because it tells you your real budget and it makes your offer credible to agents. It is not a guarantee: the property still has to value up and the lender still does final checks. If you are bidding at auction, get one.'
  },

  /* ============================================================
     D. Loan structure and features
     ============================================================ */
  {
    q: 'Should I fix my rate or go variable?',
    alt: ['fixed vs variable', 'should i fix my loan', 'fixed rate or variable rate', 'lock in my rate'],
    topic: 'structure',
    tags: ['fixed', 'variable', 'rate', 'split', 'lock', 'choose'],
    a: 'Neither is right in the abstract, it depends on what you need. Fixing locks your repayment for a set term, usually one to five years, which buys certainty, but you give up most flexibility: fixed loans typically limit extra repayments, often have no offset, and charge break costs if you exit early. Variable moves with the market, keeps offset and unlimited extra repayments available, and lets you refinance without break costs. A lot of people split the loan, fixing part for certainty and leaving part variable for flexibility. What matters is which risk you would rather carry, not what rates might do.'
  },
  {
    q: 'What is an offset account and how is it different from redraw?',
    alt: ['offset account', 'redraw facility', 'offset vs redraw', 'what is redraw', 'should i use an offset'],
    topic: 'structure',
    url: '/calculators.html#offset',
    tags: ['offset', 'redraw', 'account', 'savings', 'interest', 'difference'],
    a: 'An offset account is a normal transaction account linked to your loan. Its balance is subtracted from your loan balance before interest is calculated, so $30,000 sitting in offset on a $600,000 loan means you are charged interest on $570,000. The money stays yours and stays accessible. A redraw facility is different: extra repayments you have already made go onto the loan, and you may be able to pull them back out, but access depends on the lender\'s terms and can be restricted or changed. Offset is generally more flexible and better if you keep a decent cash balance, but it often comes with a package or annual fee, so it is only worth it if you will actually use it. Our offset calculator shows what your balance would save you.'
  },
  {
    q: 'What is a comparison rate?',
    alt: ['comparison rate meaning', 'why is the comparison rate different', 'what does comparison rate include'],
    topic: 'structure',
    tags: ['comparison', 'rate', 'aapr', 'fees', 'advertised'],
    a: 'A comparison rate folds most of a loan\'s fees into a single percentage so you can compare loans on more than the headline rate. It is useful but blunt: it is calculated on a standard example loan and term, so it does not reflect your loan size, and it ignores things that matter to you, like whether the loan has an offset or lets you make extra repayments. Use it as a filter, not a decision.'
  },
  {
    q: 'What is the difference between principal and interest and interest only?',
    alt: ['interest only loan', 'p and i', 'principal and interest', 'io loan', 'should i go interest only'],
    topic: 'structure',
    tags: ['interest only', 'principal', 'p&i', 'repayment', 'type', 'io'],
    a: 'With principal and interest you are paying down the debt as well as the interest, so the balance falls and the loan ends. With interest only you cover just the interest for a set period, usually one to five years, so repayments are lower but the balance does not move. Interest only is common for investors, partly for cash flow and partly for tax reasons, but you pay more interest over the life of the loan and repayments jump when the interest-only period ends. Lenders also assess interest-only applications more conservatively.'
  },
  {
    q: 'How much will my repayments be?',
    alt: ['repayment calculator', 'monthly repayments', 'what will i pay', 'work out repayments', 'weekly repayments'],
    topic: 'calculator',
    url: '/calculators.html#repayment',
    tags: ['repayment', 'repayments', 'monthly', 'weekly', 'fortnightly', 'pay', 'cost'],
    a: 'I can work that out now. Give me the loan amount, the interest rate and the loan term and I will show you the repayment, the total interest over the life of the loan, and what it looks like weekly or fortnightly.'
  },
  {
    q: 'Will paying extra actually save me much?',
    alt: ['extra repayments', 'pay off mortgage faster', 'lump sum on mortgage', 'pay off home loan early', 'fortnightly repayments save'],
    topic: 'calculator',
    url: '/calculators.html#lumpsum',
    tags: ['extra', 'lump sum', 'faster', 'early', 'save', 'pay off', 'additional'],
    a: 'Usually far more than people expect, because every extra dollar comes straight off the balance that interest is charged on and it compounds for the rest of the loan. A few hundred dollars a month on a typical loan often takes years off the term and saves six figures in interest. Switching from monthly to fortnightly repayments has a similar effect, because you end up making the equivalent of thirteen monthly payments a year. Tell me your loan amount, rate and how much extra you could put in and I will show you the actual numbers.'
  },

  /* ============================================================
     E. Refinancing
     ============================================================ */
  {
    q: 'Should I refinance my home loan?',
    alt: ['is it worth refinancing', 'refinance', 'switch lenders', 'better rate', 'should i switch banks'],
    topic: 'refinance',
    url: '/home-loans.html',
    tags: ['refinance', 'refinancing', 'switch', 'better rate', 'change lender', 'worth'],
    a: 'It is worth checking if your loan is more than a couple of years old, if your circumstances have changed, or if you have never had it reviewed. Lenders price new business more sharply than existing customers, so long-standing loyalty often costs money. Refinancing can also be about structure rather than rate: consolidating debt, releasing equity for a renovation or a deposit, adding an offset, or moving off interest only. The test is whether the saving over the next few years clearly beats the switching costs, and that is a five-minute calculation once I know your balance, rate and lender.'
  },
  {
    q: 'What does it cost to refinance?',
    alt: ['refinancing costs', 'exit fees', 'break costs', 'discharge fee', 'is refinancing expensive'],
    topic: 'refinance',
    tags: ['refinance', 'cost', 'fees', 'break', 'discharge', 'exit', 'switching'],
    a: 'Usually a discharge fee from your current lender, a state mortgage registration and release fee, and sometimes an application or valuation fee at the new lender, which is often waived. Together that is commonly in the several-hundred-dollar range rather than thousands. The exception is a fixed loan: breaking a fixed rate early can trigger break costs that run into thousands, calculated on the lender\'s funding loss, so always get that quoted before you decide. If your loan-to-value ratio is above 80% you may also face LMI again, and LMI is not transferable between lenders.'
  },
  {
    q: 'Can I access the equity in my home?',
    alt: ['equity release', 'use equity to buy investment', 'cash out refinance', 'borrow against my house', 'top up loan'],
    topic: 'refinance',
    tags: ['equity', 'release', 'cash out', 'top up', 'renovation', 'investment', 'access'],
    a: 'Often, yes. Usable equity is roughly 80% of your property\'s current value less what you still owe, since going past 80% brings LMI back into play. Lenders will ask what the money is for, and the purpose changes how easy it is: renovations, a deposit on an investment property or business use are all normal, but each has different evidence requirements and larger cash-out amounts get more scrutiny. A revaluation is the first step, because most people are working off what their place was worth when they bought it.'
  },
  {
    q: 'Are cashback offers worth it?',
    alt: ['refinance cashback', 'bank cashback offer', 'should i take the cashback'],
    topic: 'refinance',
    tags: ['cashback', 'offer', 'incentive', 'bonus', 'worth'],
    a: 'Sometimes, but a cashback is a one-off and the rate is forever. A few thousand dollars up front is easily wiped out by a rate that is a quarter of a percent higher over a few years on a large loan. Work out the total cost over three to five years including the cashback, and compare that. If two lenders are genuinely close on rate and structure, then the cashback is a fair tiebreaker.'
  },

  /* ============================================================
     F. Self-employed and complex income
     ============================================================ */
  {
    q: 'I am self-employed. Can I get a home loan?',
    alt: ['self employed home loan', 'business owner mortgage', 'sole trader home loan', 'abn home loan', 'low doc loan'],
    topic: 'income',
    url: '/home-loans.html',
    tags: ['self-employed', 'self employed', 'business owner', 'sole trader', 'abn', 'low doc', 'contractor'],
    a: 'Yes, and it is a big part of what we do. Most lenders want two years of tax returns and financials and will assess your income on the net profit figure, which is exactly the number a good accountant works to minimise. That is why self-employed borrowers so often look weaker on paper than they really are. Two things usually fix it. First, add-backs: depreciation, one-off expenses, additional superannuation, interest on debts being refinanced and non-cash items can often be added back to assessable income. Second, alternative verification, where some lenders accept one year of returns, or BAS statements and business bank statements instead. Bring your last two returns and we will tell you what a lender will actually see.'
  },
  {
    q: 'What documents do I need to apply?',
    alt: ['what paperwork do i need', 'documents required home loan', 'what do i need to provide', 'payslips'],
    topic: 'process',
    tags: ['documents', 'paperwork', 'payslips', 'need', 'provide', 'required', 'evidence'],
    a: 'For PAYG applicants: photo ID, your two or three most recent payslips, a recent PAYG summary or tax return, three months of bank and credit card statements, and details of any loans. For self-employed: ID, two years of tax returns and financials for you and your entities, recent BAS, and business bank statements. If you are buying, add the contract of sale, and if you are refinancing, add your current loan statements. Do not worry about assembling it perfectly up front; we will give you a specific list once we know which lender fits.'
  },

  /* ============================================================
     G. Investment
     ============================================================ */
  {
    q: 'How is an investment loan different?',
    alt: ['investment property loan', 'investor mortgage', 'buying an investment property', 'rental property loan'],
    topic: 'investment',
    tags: ['investment', 'investor', 'rental', 'property', 'negative gearing'],
    a: 'The mechanics are the same but the assessment differs. Investment loans usually carry a slightly higher rate, lenders typically want a larger deposit, and rental income is shaded, commonly counted at about 80%, to allow for vacancy and costs. Interest-only is more common for investors. Structure matters more than with an owner-occupied loan because of how interest deductibility works, so it is worth involving your accountant before the loan is set up rather than after. We are brokers, not tax advisers, so we will work with your accountant on that part.'
  },

  /* ============================================================
     H. Business, commercial and asset finance
     ============================================================ */
  {
    q: 'Do you arrange business and commercial loans?',
    alt: ['business loan', 'commercial property loan', 'business finance', 'working capital', 'commercial mortgage'],
    topic: 'commercial',
    url: '/business-commercial-loans.html',
    tags: ['business', 'commercial', 'company', 'working capital', 'cashflow', 'property'],
    a: 'Yes. That covers commercial property purchases, business acquisition and expansion funding, working capital and cash flow facilities, overdrafts and lines of credit, and refinancing existing business debt. Commercial lending is far less standardised than home lending: the deposit is usually larger, terms are shorter, and the lender is underwriting the business as much as the security. Pricing and appetite vary widely between lenders, so shopping it properly matters more here than anywhere else.'
  },
  {
    q: 'Can you finance equipment or vehicles for my business?',
    alt: ['equipment finance', 'asset finance', 'truck loan', 'machinery finance', 'chattel mortgage', 'business car loan'],
    topic: 'asset',
    url: '/asset-equipment-finance.html',
    tags: ['equipment', 'asset', 'vehicle', 'truck', 'machinery', 'chattel', 'lease', 'plant'],
    a: 'Yes. Asset and equipment finance covers vehicles and trucks, plant and machinery, fit-outs and technology, either through a chattel mortgage, a lease or a rental agreement. Because the asset itself is the security, approval often turns on the asset and the business rather than on a full property-style assessment, and low-doc options exist for established ABNs. The right structure has real tax consequences, so it is worth a quick conversation with your accountant alongside ours.'
  },
  {
    q: 'Can you help with a car loan?',
    alt: ['car finance', 'vehicle loan', 'buy a car', 'car loan rate', 'novated lease'],
    topic: 'asset',
    url: '/calculators.html#car',
    tags: ['car', 'vehicle', 'auto', 'motor', 'loan', 'finance'],
    a: 'Yes, for both personal and business vehicles, new and used. Rates on secured car loans are typically far better than on an unsecured personal loan or a dealer finance package, and the term is usually three to seven years with an optional balloon payment at the end to lower repayments. A balloon lowers your monthly cost but increases the total interest, so it is a cash-flow decision. I can run the repayment numbers for you now if you tell me the amount, rate and term.'
  },
  {
    q: 'Do you do personal loans?',
    alt: ['personal loan', 'debt consolidation', 'unsecured loan', 'consolidate my debts'],
    topic: 'personal',
    url: '/personal-loans.html',
    tags: ['personal', 'unsecured', 'consolidation', 'debt', 'consolidate'],
    a: 'Yes, for renovations, a wedding, medical costs, or consolidating higher-interest debt into one manageable repayment. Personal loans are usually one to seven years and are priced on your credit profile, secured loans coming in cheaper than unsecured. One caution on consolidation: stretching short-term debt over a long term can cost more in total even though the monthly figure looks better, and a new personal loan taken shortly before a mortgage application will reduce your borrowing power. Worth sequencing properly.'
  },

  /* ============================================================
     I. Costs, duty and process
     ============================================================ */
  {
    q: 'How much is stamp duty?',
    alt: ['stamp duty', 'transfer duty', 'duty calculator', 'stamp duty in vic', 'stamp duty nsw', 'land transfer duty'],
    topic: 'calculator',
    url: '/calculators.html#stampduty',
    tags: ['stamp duty', 'duty', 'transfer', 'state', 'government', 'tax'],
    a: 'Stamp duty, properly land transfer duty, is set by each state and territory on a sliding scale, and first home buyers get significant concessions or exemptions in most states. I can calculate it for you: tell me the state and the purchase price, and whether you are a first home buyer and whether it will be your home or an investment.'
  },
  {
    q: 'What other upfront costs should I budget for?',
    alt: ['costs of buying a house', 'upfront costs', 'hidden costs buying', 'conveyancing fees', 'what will i need in cash'],
    topic: 'costs',
    tags: ['costs', 'upfront', 'fees', 'conveyancing', 'legal', 'inspection', 'budget', 'cash'],
    a: 'Beyond the deposit: stamp duty, land transfer and mortgage registration fees, conveyancing or legal fees usually in the $1,500 to $3,000 range, building and pest inspections of a few hundred each, loan application or valuation fees where they are not waived, LMI if you are above 80%, plus moving costs, connections and insurance. A common planning rough-cut is around 5% of the purchase price for costs on top of your deposit, though duty concessions can change that a lot. Our stamp duty calculator itemises the government part.'
  },
  {
    q: 'How long does the whole process take?',
    alt: ['how long does approval take', 'timeline home loan', 'how long to settlement', 'how fast can i get approved'],
    topic: 'process',
    tags: ['how long', 'time', 'timeline', 'approval', 'settlement', 'fast', 'takes'],
    a: 'Broadly: pre-approval commonly takes a few days to a couple of weeks depending on the lender and how complete your documents are. Once you have a signed contract, formal approval usually lands within one to two weeks, subject to valuation. Settlement is then set by the contract, most often 30, 60 or 90 days. The single biggest cause of delay is missing paperwork, so getting documents in early is the one thing genuinely within your control.'
  },
  {
    q: 'What actually happens when I work with you?',
    alt: ['how does it work', 'what is the process', 'what are the steps', 'how do you work', 'next steps'],
    topic: 'process',
    tags: ['process', 'steps', 'how', 'work', 'expect', 'happens'],
    a: 'A 15-minute strategy call first, where we work out what you are trying to do and whether it is realistic. Then we gather your numbers and documents and confirm your position properly. We compare lender options and explain the shortlist and the trade-offs, you choose, and we prepare and lodge the application and deal with the lender through to approval. After that we manage it through to settlement alongside your conveyancer, and we stay in touch afterwards to review the loan rather than leaving you on a rate that drifts.'
  },
  {
    q: 'What is the Finance Square Score?',
    alt: ['finance square score', 'my score', 'get my score'],
    topic: 'fhb',
    url: '/first-home-buyers.html#score',
    tags: ['score', 'finance square score', 'assessment', 'readiness'],
    a: 'The Finance Square Score is a quick read on how ready you are to borrow right now, and what is holding the number back. It does not involve a credit check and it does not affect your credit file. It gives you a realistic picture before you start looking at properties, which is a much better order to do things in.'
  },

  /* ============================================================
     J. Credit history
     ============================================================ */
  {
    q: 'Can I get a loan with bad credit or a default?',
    alt: ['bad credit home loan', 'default on my credit file', 'missed payments mortgage', 'credit impaired', 'bankruptcy home loan'],
    topic: 'credit',
    tags: ['bad credit', 'default', 'arrears', 'impaired', 'bankruptcy', 'missed', 'judgement'],
    a: 'Often yes, but it depends on what the issue is, how large, how old and whether it is paid. Major banks are strict. Specialist and non-bank lenders will look at defaults, past arrears and discharged bankruptcy, usually at a lower loan-to-value ratio and a higher rate, with the intention of refinancing you back to a mainstream lender once the record ages out. The worst move is applying repeatedly to banks and adding enquiries to your file. Get a copy of your credit report first, then let us match it to a lender that will actually consider it.'
  },

  /* ============================================================
     K. Compliance and privacy
     ============================================================ */
  {
    q: 'Is my information safe and what do you do with it?',
    alt: ['privacy', 'data protection', 'what do you do with my details', 'privacy policy', 'is my data secure'],
    topic: 'compliance',
    url: '/privacy-policy/',
    tags: ['privacy', 'data', 'information', 'safe', 'secure', 'personal'],
    a: 'Anything you share with us is handled under our Privacy Policy and our Privacy Disclosure and Consent, both linked in the footer of every page. In short, we collect what we need to assess your situation and arrange finance, we share it with lenders only with your consent, and we do not sell it. You can ask us for a copy of what we hold at any time.'
  },
  {
    q: 'What if I have a complaint?',
    alt: ['complaint', 'dispute', 'afca', 'unhappy with service', 'how do i complain'],
    topic: 'compliance',
    url: '/terms.html#complaints',
    tags: ['complaint', 'complaints', 'dispute', 'afca', 'ombudsman', 'unhappy'],
    a: 'Tell us first and we will try to sort it out: 0495 040 500 or info@fnsq.com.au. If you are not satisfied with our response, you can take it to the Australian Financial Complaints Authority, our external dispute resolution scheme, free of charge. AFCA can be reached at afca.org.au or on 1800 931 678. Our AFCA membership number is 94619.'
  },
  {
    q: 'Are you licensed?',
    alt: ['credit licence', 'are you accredited', 'acl', 'mfaa', 'qualifications', 'regulated'],
    topic: 'compliance',
    tags: ['licence', 'license', 'acl', 'credit representative', 'accredited', 'mfaa', 'regulated'],
    a: 'Yes. Priya Dey is Credit Representative 543438 of BLSSA Pty Ltd, which holds Australian Credit Licence 391237. We are also members of the MFAA and of AFCA, the external dispute resolution scheme, membership number 94619.'
  },

  /* ============================================================
     L. Chat-specific
     ============================================================ */
  {
    q: 'Are you a real person?',
    alt: ['are you a bot', 'is this a robot', 'am i talking to a human', 'are you ai', 'are you human'],
    topic: 'meta',
    tags: ['bot', 'robot', 'human', 'real', 'ai', 'person'],
    a: 'I am Finance Square\'s automated assistant, not a person. I can answer questions, run the calculators and book you in, but I cannot give you credit advice or approve anything. For that you want Priya, and I can put a 15-minute call in her diary whenever you like.'
  },
  {
    q: 'Can you give me advice on what loan to get?',
    alt: ['what loan should i get', 'which lender is best', 'give me advice', 'what do you recommend', 'best home loan'],
    topic: 'meta',
    tags: ['advice', 'recommend', 'best', 'should i', 'which lender', 'suggest'],
    a: 'I can explain how things work and run the numbers, but I am not able to give you credit advice or recommend a specific product. Which lender and structure suits you depends on your full position, and a recommendation has to come from a licensed credit representative after a proper assessment. That is exactly what the 15-minute call is for, and it is free.'
  },
  {
    q: 'What are your rates?',
    alt: ['current interest rates', 'what rate can i get', 'best rate', 'lowest rate', 'rate today'],
    topic: 'meta',
    tags: ['rate', 'rates', 'interest', 'current', 'today', 'lowest', 'best'],
    a: 'We do not publish a rate, because the rate you can actually get depends on your deposit, your loan size, the property, your income type and your credit profile, and the sharpest advertised rate is often attached to a loan with no offset or tight policy. What we can do is pull real pricing across our lender panel for your specific situation and show you the shortlist. That is a call, not a chat answer.'
  }
];
