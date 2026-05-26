export interface Reply {
  id: string;
  author: string;
  authorRole: "admin" | "user" | "mentor";
  content: string;
  timestamp: string;
  likes: number;
}

export interface Thread {
  id: string;
  question: string;
  category: string;
  originalAuthor: string;
  authorRole: "user";
  initialAnswer: string;
  answeredBy: string;
  answeredByRole: "admin" | "mentor";
  createdAt: string;
  resolvedAt: string;
  replies: Reply[];
  views: number;
  status: "open" | "resolved";
}

export const threadsData: Thread[] = [
  {
    id: "thread-1",
    question: "Can my HOD email the NOC instead of signing a printout?",
    category: "NOC",
    originalAuthor: "rohan.k@iitr.ac.in",
    authorRole: "user",
    initialAnswer:
      "Yes — there is a fully-equivalent email-forward path. Your HOD forwards the text NOC to sudarshan@iitrpr.ac.in from their official institutional email address with subject: 'NOC for my student <Your Full Name>'. The forward itself counts as the signature.",
    answeredBy: "Sudarshan Iyengar",
    answeredByRole: "admin",
    createdAt: "2026-05-22 10:30",
    resolvedAt: "2026-05-22 14:15",
    views: 234,
    status: "resolved",
    replies: [
      {
        id: "r1-1",
        author: "Priya Sharma",
        authorRole: "user",
        content:
          "Quick follow-up — does the HOD need to attach the NOC PDF or can they just write a short approval in the email body?",
        timestamp: "2026-05-22 15:30",
        likes: 12,
      },
      {
        id: "r1-2",
        author: "Sudarshan Iyengar",
        authorRole: "admin",
        content:
          "Great question! The HOD must forward the original text NOC file (downloaded from the dashboard). The email body can be a simple 'Approved' or 'Forwarding NOC for my student'. The structured text NOC is what we verify.",
        timestamp: "2026-05-22 16:00",
        likes: 28,
      },
      {
        id: "r1-3",
        author: "Aman Verma",
        authorRole: "user",
        content:
          "I tried this and got my offer letter within 2 hours. Much faster than the PDF route!",
        timestamp: "2026-05-23 09:00",
        likes: 18,
      },
    ],
  },
  {
    id: "thread-2",
    question: "How do I form a team if I don't know anyone in the cohort?",
    category: "Team Formation",
    originalAuthor: "neha.s@university.edu",
    authorRole: "user",
    initialAnswer:
      "For students joining later: Teams will be randomly assigned by the administration. You don't need to actively form a team yourself. The admin will match you with 3 other students from different institutions to ensure diverse networking.",
    answeredBy: "Vaishali Mentor",
    answeredByRole: "mentor",
    createdAt: "2026-05-21 11:20",
    resolvedAt: "2026-05-21 12:45",
    views: 189,
    status: "resolved",
    replies: [
      {
        id: "r2-1",
        author: "Neha Sharma",
        authorRole: "user",
        content:
          "Thanks! When can I expect to know my team members?",
        timestamp: "2026-05-21 13:00",
        likes: 8,
      },
      {
        id: "r2-2",
        author: "Vaishali Mentor",
        authorRole: "mentor",
        content:
          "Team announcements happen in phases via email. You'll get an email with team details typically within 5-7 days of starting. Please check your inbox regularly including spam folder.",
        timestamp: "2026-05-21 13:30",
        likes: 15,
      },
    ],
  },
  {
    id: "thread-3",
    question: "Why does ViBe keep pausing my video even when I'm watching?",
    category: "ViBe Platform",
    originalAuthor: "arjun.m@bitsedu.in",
    authorRole: "user",
    initialAnswer:
      "This is usually due to ViBe's proctoring system. Common causes: (1) Your face is too dark - add a lamp in front of you, (2) You're slightly out of frame, (3) Background voices detected, (4) You switched tabs. Check camera/mic permissions in your browser.",
    answeredBy: "Pavani Tech",
    answeredByRole: "admin",
    createdAt: "2026-05-23 16:00",
    resolvedAt: "2026-05-23 16:45",
    views: 312,
    status: "resolved",
    replies: [
      {
        id: "r3-1",
        author: "Arjun Mehta",
        authorRole: "user",
        content:
          "I added a lamp and it's much better now. But sometimes it still pauses when I look at my notebook briefly. Is that normal?",
        timestamp: "2026-05-23 17:00",
        likes: 22,
      },
      {
        id: "r3-2",
        author: "Pavani Tech",
        authorRole: "admin",
        content:
          "Brief glances are absolutely fine. The system only flags sustained patterns (15+ seconds of looking away). If you take notes, do it during pauses between clips rather than during.",
        timestamp: "2026-05-23 17:15",
        likes: 34,
      },
      {
        id: "r3-3",
        author: "Sneha Patel",
        authorRole: "user",
        content:
          "Pro tip: I use a second monitor for notes. ViBe stays focused on my main screen and never pauses!",
        timestamp: "2026-05-24 08:00",
        likes: 41,
      },
    ],
  },
  {
    id: "thread-4",
    question: "Is the Rosetta journal mandatory or just recommended?",
    category: "Rosetta Journal",
    originalAuthor: "kavya.r@iitm.ac.in",
    authorRole: "user",
    initialAnswer:
      "Rosetta is mandatory. It's one of the required completion criteria for the certificate. You must fill in all 65 entries, one per day. Incomplete or AI-generated journals will not be accepted.",
    answeredBy: "Rajan Coordinator",
    answeredByRole: "mentor",
    createdAt: "2026-05-20 14:00",
    resolvedAt: "2026-05-20 14:30",
    views: 156,
    status: "resolved",
    replies: [
      {
        id: "r4-1",
        author: "Kavya Reddy",
        authorRole: "user",
        content:
          "What if I'm sick for 2-3 days and miss entries?",
        timestamp: "2026-05-20 15:00",
        likes: 19,
      },
      {
        id: "r4-2",
        author: "Rajan Coordinator",
        authorRole: "mentor",
        content:
          "Fill them in as soon as you can recover. Write the actual date you're filling it in (not the missed date) and be honest in the entry that you're writing late and why. A late honest entry is always better than no entry.",
        timestamp: "2026-05-20 15:30",
        likes: 27,
      },
    ],
  },
  {
    id: "thread-5",
    question: "Can I switch from VINS to VISE after selection?",
    category: "About the Internship",
    originalAuthor: "vikram.s@nitwarangal.ac.in",
    authorRole: "user",
    initialAnswer:
      "No. The two tracks are finalised at the interview stage, and we do not move candidates between them. VISE has a fixed on-campus capacity. VINS is not a consolation track — the project, mentor, and certificate are the same.",
    answeredBy: "Sudarshan Iyengar",
    answeredByRole: "admin",
    createdAt: "2026-05-19 10:00",
    resolvedAt: "2026-05-19 11:00",
    views: 98,
    status: "resolved",
    replies: [
      {
        id: "r5-1",
        author: "Vikram Singh",
        authorRole: "user",
        content:
          "Understood. Thanks for the clarification!",
        timestamp: "2026-05-19 11:30",
        likes: 5,
      },
    ],
  },
];
