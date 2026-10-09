// Source: NIST SP 1300, "NIST Cybersecurity Framework 2.0: Small Business Quick-Start Guide" (Feb 2024)
// https://doi.org/10.6028/NIST.SP.1300
export const FUNCTIONS = [
  {
    id: 'GV',
    name: 'Govern',
    summary: "Establish and monitor your business's cybersecurity risk management strategy, expectations, and policy.",
    controls: [
      { id: 'GV.OC-01', phase: 'Understand', text: "Understand how cybersecurity risks can disrupt achievement of your business's mission." },
      { id: 'GV.OC-03', phase: 'Understand', text: 'Understand your legal, regulatory, and contractual cybersecurity requirements.' },
      { id: 'GV.RR-02', phase: 'Understand', text: 'Understand who within your business will be responsible for developing and executing the cybersecurity strategy.' },
      { id: 'GV.OC-04', phase: 'Assess', text: 'Assess the potential impact of a total or partial loss of critical business assets and operations.' },
      { id: 'GV.RM-04', phase: 'Assess', text: 'Assess whether cybersecurity insurance is appropriate for your business.' },
      { id: 'GV.SC-06', phase: 'Assess', text: 'Assess cybersecurity risks posed by suppliers and other third parties before entering into formal relationships.' },
      { id: 'GV.RM-03', phase: 'Prioritize', text: 'Prioritize managing cybersecurity risks alongside other business risks.' },
      { id: 'GV.RR-01', phase: 'Communicate', text: "Communicate leadership's support of a risk-aware, ethical, and continually improving culture." },
      { id: 'GV.PO-01', phase: 'Communicate', text: 'Communicate, enforce, and maintain policies for managing cybersecurity risks.' },
    ],
  },
  {
    id: 'ID',
    name: 'Identify',
    summary: 'Determine the current cybersecurity risk to the business.',
    controls: [
      { id: 'ID.AM-01/02/04', phase: 'Understand', text: 'Understand what assets your business relies upon by creating and maintaining an inventory of hardware, software, systems, and services.' },
      { id: 'ID.RA-01', phase: 'Assess', text: 'Assess your assets (IT and physical) for potential vulnerabilities.' },
      { id: 'ID.IM-01', phase: 'Assess', text: "Assess the effectiveness of the business's cybersecurity program to identify areas that need improvement." },
      { id: 'ID.AM-07', phase: 'Prioritize', text: 'Prioritize inventorying and classifying your business data.' },
      { id: 'ID.RA', phase: 'Prioritize', text: 'Prioritize documenting internal and external cybersecurity threats and associated responses using a risk register.' },
      { id: 'ID.IM-04', phase: 'Communicate', text: 'Communicate cybersecurity plans, policies, and best practices to all staff and relevant third parties.' },
      { id: 'ID.IM', phase: 'Communicate', text: 'Communicate to staff the importance of identifying needed improvements to cybersecurity risk management processes, procedures, and activities.' },
    ],
  },
  {
    id: 'PR',
    name: 'Protect',
    summary: 'Use safeguards to prevent or reduce cybersecurity risks.',
    controls: [
      { id: 'PR.AA-05', phase: 'Understand', text: 'Understand what information employees should or do have access to; restrict sensitive information to only those who need it.' },
      { id: 'PR.AT-01/02', phase: 'Assess', text: "Assess the timeliness, quality, and frequency of your company's cybersecurity training for employees." },
      { id: 'PR.AA-03', phase: 'Prioritize', text: 'Prioritize requiring multi-factor authentication on all accounts that offer it; consider a password manager.' },
      { id: 'PR.AA-01', phase: 'Prioritize', text: 'Prioritize changing default manufacturer passwords.' },
      { id: 'PR.PS-02', phase: 'Prioritize', text: 'Prioritize regularly updating and patching software and operating systems; enable automatic updates.' },
      { id: 'PR.DS-11', phase: 'Prioritize', text: 'Prioritize regularly backing up your data and testing your backups.' },
      { id: 'PR.DS-01', phase: 'Prioritize', text: 'Prioritize configuring tablets and laptops to enable full-disk encryption to protect data.' },
      { id: 'PR.AT-01/02 (comm)', phase: 'Communicate', text: 'Communicate to staff how to recognize common attacks, report suspicious activity, and perform basic cyber hygiene.' },
    ],
  },
  {
    id: 'DE',
    name: 'Detect',
    summary: 'Find and analyze possible cybersecurity attacks and compromises.',
    controls: [
      { id: 'DE.CM', phase: 'Understand', text: 'Understand how to identify common indicators of a cybersecurity incident.' },
      { id: 'DE.CM-06/09', phase: 'Assess', text: 'Assess your computing technologies and external services for deviations from expected or typical behavior.' },
      { id: 'DE.CM-02', phase: 'Assess', text: 'Assess your physical environment for signs of tampering or suspicious activity.' },
      { id: 'DE.CM-09', phase: 'Prioritize', text: 'Prioritize installing and maintaining antivirus and anti-malware software on all business devices.' },
      { id: 'DE.CM (svc)', phase: 'Prioritize', text: "Prioritize engaging a service provider to monitor computers and networks if you lack the resources to do it internally." },
      { id: 'DE.AE-06/07', phase: 'Communicate', text: 'Communicate with your authorized incident responder about the relevant details of an incident.' },
    ],
  },
  {
    id: 'RS',
    name: 'Respond',
    summary: 'Take action regarding a detected cybersecurity incident.',
    controls: [
      { id: 'RS.MA-01', phase: 'Understand', text: 'Understand what your incident response plan is and who has authority and responsibility for it.' },
      { id: 'RS.MA-01 (assess)', phase: 'Assess', text: 'Assess your ability to respond to a cybersecurity incident.' },
      { id: 'RS.AN-03 / RS.MA-03', phase: 'Assess', text: 'Assess the incident to determine its severity, what happened, and its root cause.' },
      { id: 'RS.MI', phase: 'Prioritize', text: 'Prioritize taking steps to contain and eradicate the incident to prevent further damage.' },
      { id: 'RS.CO-02/03', phase: 'Communicate', text: 'Communicate a confirmed cybersecurity incident with all internal and external stakeholders as required.' },
    ],
  },
  {
    id: 'RC',
    name: 'Recover',
    summary: 'Restore assets and operations that were impacted by a cybersecurity incident.',
    controls: [
      { id: 'RC.RP-01', phase: 'Understand', text: 'Understand who within and outside your business has recovery responsibilities.' },
      { id: 'RC.RP-06 (report)', phase: 'Assess', text: 'Assess what happened by preparing an after-action report documenting the incident and lessons learned.' },
      { id: 'RC.RP-03', phase: 'Assess', text: 'Assess the integrity of your backed-up data and assets before using them for restoration.' },
      { id: 'RC.RP-02', phase: 'Prioritize', text: 'Prioritize your recovery actions based on organizational needs, resources, and assets impacted.' },
      { id: 'RC.CO', phase: 'Communicate', text: 'Communicate regularly and securely with internal and external stakeholders.' },
      { id: 'RC.RP-06 (comm)', phase: 'Communicate', text: 'Communicate and document completion of the incident and resumption of normal activities.' },
    ],
  },
];

export const SOURCE = {
  title: "NIST CSF 2.0: Small Business Quick-Start Guide",
  doi: 'https://doi.org/10.6028/NIST.SP.1300',
  publication: 'NIST SP 1300',
  published: '2024-02',
};
