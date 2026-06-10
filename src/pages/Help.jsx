import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'

const sections = [
  {
    title: '🚀 Getting started',
    content: [
      {
        heading: 'Add a client first',
        text: 'Go to Clients and tap "Add client". Fill in their name, how they usually pay (cash or bank transfer), and their hourly rate if you charge one. Once you have a client, you can start logging jobs and payments.',
      },
      {
        heading: 'Set up your profile',
        text: 'Open Profile → Personal & HMRC and fill in your home address and postcode — LogAll uses this to calculate mileage automatically. Add your National Insurance number and UTR for tax purposes.',
      },
      {
        heading: 'Set your working hours',
        text: 'In Profile → Working hours, set your working days, start and finish times, and how long you travel between jobs. LogAll uses these to work out how many free slots you have each month, shown on the Schedule.',
      },
    ],
  },
  {
    title: '👥 Clients',
    content: [
      {
        heading: 'Adding a client',
        text: 'Tap "Add client" and enter their name, payment method and hourly rate. You can also add their address and mobile number — the address is used for mileage and the mobile for quick WhatsApp messages.',
      },
      {
        heading: 'Quick WhatsApp messages',
        text: 'Open a client (with a mobile number saved) and tap one of the Quick messages — "Coming tomorrow", "On my way", "Running late" or a payment reminder. WhatsApp opens with the message already written, including the time or amount where relevant.',
      },
      {
        heading: 'Log a visit or mileage',
        text: 'From a client\'s page you can jump straight to logging a visit or a mileage journey for that client.',
      },
    ],
  },
  {
    title: '📅 Schedule',
    content: [
      {
        heading: 'Adding a job',
        text: 'Tap "+ Add job" from the Schedule screen. Pick a client, date, time and duration. If you charge by the hour, the amount fills in automatically from the client\'s hourly rate.',
      },
      {
        heading: 'Recurring jobs',
        text: 'When adding a job, set "How often?" to Weekly, Bi-weekly or Monthly. LogAll will automatically create the next 8 weeks of visits for you — you\'ll never need to add them one by one.',
      },
      {
        heading: 'How much capacity have I got?',
        text: 'In the month view you\'ll see pills showing how many One-off, Weekly and Bi-weekly slots you have free, worked out from your working hours and existing jobs. Tap a pill to see exactly which dates are available, then tap a date to add a job there.',
      },
      {
        heading: 'Recurring time off',
        text: 'Set regular time off in Profile → Working hours — a whole day, or just mornings or afternoons (for example, every Friday afternoon). It shows on the calendar (half-shaded for part days) and is taken into account when working out your free capacity.',
      },
      {
        heading: 'Marking a job as done',
        text: 'Tap on a job card to expand it, then tap "Done & paid". The payment is automatically added to your Income. If they haven\'t paid yet, tap "Awaiting payment" instead — it\'ll show up in Outstanding Payments until you chase it up.',
      },
      {
        heading: 'Bulk select',
        text: 'Tap "Select jobs" (bottom right of the date line) to select multiple jobs at once. You can then cancel or delete them all in one go — useful for clearing a run of cancelled visits.',
      },
      {
        heading: 'Income totals on the calendar',
        text: 'Tap the £ button next to the month name to show how much you earned on each day of the month. Tap it again to hide.',
      },
    ],
  },
  {
    title: '💷 Income',
    content: [
      {
        heading: 'Auto-logging',
        text: 'When you mark a job as "Done & paid" on the Schedule, the payment is logged automatically — you don\'t need to do anything else. It uses the job\'s date and amount.',
      },
      {
        heading: 'Manual logging',
        text: 'You can also log payments manually from the Income tab. Tap "Log payment", enter the amount, choose the client and how they paid.',
      },
      {
        heading: 'Changing a payment status',
        text: 'If you mark a job as "Awaiting payment" after it was "Done & paid", the income record is removed automatically. Mark it as paid again and it comes back.',
      },
    ],
  },
  {
    title: '🚗 Mileage',
    content: [
      {
        heading: 'Why log mileage?',
        text: 'Every mile you drive to a client\'s home comes off your tax bill at the HMRC approved rate — 55p per mile for the first 10,000 business miles in the year, then 25p after that. Drive 5,000 miles for work and that\'s £2,750 you can deduct from your income before tax.',
      },
      {
        heading: 'Logging a journey',
        text: 'Go to Mileage and tap "Log journey". Enter where you\'re going from and to, then tap "Calculate distance automatically". LogAll works out the miles using your postcode. Your home address fills in automatically from your Profile.',
      },
      {
        heading: 'Journeys with several stops',
        text: 'Add more than one destination with "Add stop" — handy for a day visiting several clients. Each stop has its own Home and client buttons, and you can shuffle the order with the up/down arrows to match the order you actually drove.',
      },
      {
        heading: 'Today\'s jobs in one tap',
        text: 'Tap "Today\'s jobs" and LogAll builds a route for you: from home, round all of today\'s scheduled clients in time order, and back home again. Just tap calculate to get the miles.',
      },
      {
        heading: 'Quick fill buttons',
        text: 'Below the From and To fields you\'ll see quick-fill buttons for your home and each client. Tap a client\'s name to fill in their postcode instantly.',
      },
      {
        heading: 'Electric vehicles',
        text: 'You still claim the same mileage rate if you drive an electric vehicle — but you cannot also claim charging costs. It\'s one or the other.',
      },
    ],
  },
  {
    title: '🧴 Expenses',
    content: [
      {
        heading: 'What can I claim?',
        text: 'Anything you buy specifically for work. For cleaners this includes: cleaning products, equipment (mops, hoovers), PPE and clothing with a logo, insurance, and a portion of your phone bill.',
      },
      {
        heading: 'How to log an expense',
        text: 'Go to Expenses, tap "+ Add expense", pick a category and enter the amount. LogAll shows you how much tax you\'re saving as you go — usually 20p for every £1 you spend on allowable expenses.',
      },
      {
        heading: 'Attach a receipt photo',
        text: 'When logging an expense you can snap or upload a photo of the receipt. It\'s saved to your own Google Drive (connect it in Profile → Account), and expenses with a receipt show a 🧾 badge so you know it\'s backed up.',
      },
      {
        heading: 'Recurring expenses',
        text: 'Mark an expense as monthly or annual and LogAll gives you a one-tap "Log for [month]" button — so regular costs like insurance or your phone bill take seconds to record each time.',
      },
      {
        heading: 'AIA for equipment',
        text: 'For equipment (like a new hoover), toggle on "Annual Investment Allowance" to claim the full cost in year one rather than spreading it.',
      },
      {
        heading: 'What can\'t I claim?',
        text: 'Anything with a personal element — a new phone you also use personally can only be claimed partially. Food, travel clothing (not workwear), and anything not directly related to your work can\'t be claimed.',
      },
    ],
  },
  {
    title: '🧮 Tax',
    content: [
      {
        heading: 'The most important number',
        text: '"Set aside every month" is the number to focus on. Put this amount into a savings account every month and your January Self Assessment bill won\'t be a shock.',
      },
      {
        heading: 'How it\'s calculated',
        text: 'LogAll takes your total income, deducts your expenses and mileage claims, then calculates Income Tax (20%, rising to 40% and 45% on higher profits) and Class 4 National Insurance (6%). Class 2 National Insurance is no longer payable for most sole traders. These are estimates.',
      },
      {
        heading: 'The income slider',
        text: 'Use the slider to see what your tax bill would be if your income changes — useful for planning whether to take on more clients.',
      },
      {
        heading: 'Self Assessment checklist',
        text: 'The SA Checklist walks you through everything you need before filing, grouped into stages with a progress bar that remembers what you\'ve ticked off.',
      },
      {
        heading: 'Home office calculator',
        text: 'If you do paperwork from home, the Home Office calculator compares HMRC\'s simple flat rate against working out your actual costs, and shows which one saves you more.',
      },
      {
        heading: 'Tax report for your accountant',
        text: 'Open the Tax Report for a print-ready summary of your year. Tap "Print / Save as PDF" to share it, or download your income, expenses and mileage as separate CSV files.',
      },
      {
        heading: 'Making Tax Digital (MTD)',
        text: 'MTD for Income Tax starts for many sole traders from April 2026. The Tax Report\'s "MTD Export" produces your SA103S figures — for the whole year or a single quarter — ready to drop into bridging software.',
      },
      {
        heading: 'Self Assessment deadline',
        text: 'The deadline for filing your Self Assessment online is 31 January each year. LogAll links to the HMRC website at the bottom of the Tax page.',
      },
    ],
  },
  {
    title: '⏳ Outstanding payments',
    content: [
      {
        heading: 'What shows here?',
        text: 'Any job marked "Awaiting payment" appears here, colour-coded by how overdue it is — amber (up to 7 days), orange (up to 14 days), red (over 14 days).',
      },
      {
        heading: 'Sending a reminder',
        text: 'Tap "Send reminder" on a job to open a pre-written WhatsApp or SMS message ready to send. Or tap "Remind all" at the top to go through every overdue client in one session.',
      },
      {
        heading: 'Marking as paid',
        text: 'Tap "Mark paid" and the income is logged automatically. The job moves from Outstanding to Done & paid.',
      },
    ],
  },
  {
    title: '👤 Profile & account',
    content: [
      {
        heading: 'Four areas',
        text: 'Your profile is split into four sections: Personal & HMRC (your details and tax numbers), Working hours (days, hours and time off), Notifications, and Account.',
      },
      {
        heading: 'Connect Google Drive',
        text: 'In Profile → Account, connect Google Drive so receipt photos are saved to your own Drive. You can disconnect again at any time.',
      },
      {
        heading: 'Dark mode',
        text: 'Switch between light and dark mode in Profile → Account — handy for logging jobs in the evening.',
      },
      {
        heading: 'Extra security',
        text: 'Turn on two-factor authentication in Profile → Account to protect your account with a code from an authenticator app each time you sign in.',
      },
    ],
  },
  {
    title: '🔔 Notifications',
    content: [
      {
        heading: 'Turning them on',
        text: 'Allow notifications in Profile → Notifications, then switch each type on or off to suit you. They\'re reminders only — nothing is shared with anyone.',
      },
      {
        heading: 'What you can be reminded about',
        text: 'Expense reminders (if you haven\'t logged anything in a while), the Self Assessment deadline (30, 7 and 1 day before 31 January), MTD quarterly deadlines, and overdue payments.',
      },
    ],
  },
  {
    title: '💡 Tips & tricks',
    content: [
      {
        heading: 'Install on your home screen',
        text: 'On Android, tap "Install" when the banner appears. On iPhone, tap the Share button in Safari then "Add to Home Screen". LogAll works like a proper app — no browser bar, works offline.',
      },
      {
        heading: 'Bank holidays on the calendar',
        text: 'UK bank holidays are automatically highlighted in red on the calendar. Add your own holidays in Profile → Working hours — they show in purple.',
      },
      {
        heading: 'Adding past jobs in bulk',
        text: 'Go to Schedule and tap "Add past jobs in bulk" at the bottom. Pick a client, date range and frequency. LogAll creates all the visits and logs the income in one go.',
      },
      {
        heading: 'Postcode only for mileage',
        text: 'LogAll uses postcodes (not full addresses) for distance calculations — this gives a more accurate road distance.',
      },
    ],
  },
]

function Section({ section }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4 text-left active:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900 dark:text-white text-sm">{section.title}</span>
        {open ? <ChevronUp size={18} className="text-gray-400 dark:text-gray-500 flex-shrink-0" /> : <ChevronDown size={18} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
          {section.content.map((item, i) => (
            <div key={i} className="px-4 py-3.5">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">{item.heading}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Help() {
  const navigate = useNavigate()
  return (
    <div className="p-4 pb-8 md:p-8 md:max-w-3xl md:mx-auto">
      <div className="pt-2 flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400 dark:text-gray-500 active:text-gray-600 dark:text-gray-300">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Help</h1>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-xs mt-0.5">How to use LogAll</p>
        </div>
      </div>

      <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-5">
        <p className="text-sm font-semibold text-green-800 mb-1">👋 Welcome to LogAll</p>
        <p className="text-sm text-green-700 leading-relaxed">
          LogAll helps you keep on top of your jobs, income, mileage and expenses — so you always know what you owe in tax and never miss a payment. Tap any section below to learn more.
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((section, i) => (
          <Section key={i} section={section} />
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6 leading-relaxed">
        LogAll is designed for UK self-employed sole traders. Tax calculations are estimates — always consult a qualified accountant for advice.
      </p>
    </div>
  )
}
