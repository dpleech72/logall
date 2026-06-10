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
        text: 'Go to Profile and fill in your home address and postcode — LogAll uses this to calculate mileage automatically. Add your National Insurance number and UTR for tax purposes.',
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
        text: 'Every mile you drive to a client\'s home is worth 55p off your tax bill (the HMRC approved rate). If you drive 5,000 miles a year for work, that\'s £2,750 you can deduct from your income before tax is calculated.',
      },
      {
        heading: 'Logging a journey',
        text: 'Go to Mileage and tap "Log journey". Enter where you\'re going from and to, then tap "Calculate distance automatically". LogAll works out the miles using your postcode. Your home address fills in automatically from your Profile.',
      },
      {
        heading: 'Quick fill buttons',
        text: 'Below the From and To fields you\'ll see quick-fill buttons for your home and each client. Tap a client\'s name to fill in their postcode instantly.',
      },
      {
        heading: 'Electric vehicles',
        text: 'You still claim 55p/mile if you drive an electric vehicle — but you cannot also claim charging costs. It\'s one or the other.',
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
        heading: 'Tax report for your accountant',
        text: 'Tap "Download tax report" to open a print-ready page showing all your figures for the tax year. Tap "Print / Save as PDF" and share it with your accountant.',
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
    title: '💡 Tips & tricks',
    content: [
      {
        heading: 'Install on your home screen',
        text: 'On Android, tap "Install" when the banner appears. On iPhone, tap the Share button in Safari then "Add to Home Screen". LogAll works like a proper app — no browser bar, works offline.',
      },
      {
        heading: 'Bank holidays on the calendar',
        text: 'UK bank holidays are automatically highlighted in red on the calendar. Add your own holidays in Profile — they show in purple.',
      },
      {
        heading: 'Adding past jobs in bulk',
        text: 'Go to Schedule and tap "Add past jobs in bulk" at the bottom. Pick a client, date range and frequency. LogAll creates all the visits and logs the income in one go.',
      },
      {
        heading: 'Daily payment reminder',
        text: 'If you have overdue payments, LogAll will send a notification once a day reminding you to chase them up. Allow notifications when prompted.',
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
