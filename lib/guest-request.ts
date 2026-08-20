export function createLocalRequestNumber(now = new Date()) {
  return `AM-LOCAL-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
}

export function guestRequestNextAction() {
  return "حُفظ الطلب على هذا الجهاز فقط. لا يُرسل إلى الخادم ولا تتم مزامنته تلقائياً عند تسجيل الدخول.";
}
