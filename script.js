const form = document.getElementById("contactForm");
const success = document.getElementById("formSuccess");
const contactEmail = window.SITE_CONFIG?.contactEmail || "roy.0817.soccer@gmail.com";

const validators = {
  name: (value) => (value.trim() ? "" : "お名前を入力してください。"),
  email: (value) => {
    if (!value.trim()) return "メールアドレスを入力してください。";
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(value) ? "" : "メールアドレスの形式をご確認ください。";
  },
  phone: (value) => {
    if (!value.trim()) return "";
    const phonePattern = /^[0-9-+()\s]{8,}$/;
    return phonePattern.test(value) ? "" : "電話番号の形式をご確認ください。";
  },
  service: (value) => (value ? "" : "ご相談したい事業を選択してください。"),
  message: (value) => (value.trim() ? "" : "お問い合わせ内容を入力してください。"),
};

function setError(name, message) {
  const node = document.querySelector(`[data-for="${name}"]`);
  if (node) node.textContent = message;
}

function validateField(field) {
  const validate = validators[field.name];
  if (!validate) return true;
  const message = validate(field.value);
  setError(field.name, message);
  return !message;
}

Object.keys(validators).forEach((name) => {
  const field = form.elements.namedItem(name);
  if (!field) return;

  field.addEventListener("blur", () => {
    validateField(field);
  });

  field.addEventListener("input", () => {
    if (document.querySelector(`[data-for="${name}"]`)?.textContent) {
      validateField(field);
    }
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  success.textContent = "";

  const fields = Object.keys(validators)
    .map((name) => form.elements.namedItem(name))
    .filter(Boolean);

  const isValid = fields.every((field) => validateField(field));
  if (!isValid) {
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());
  localStorage.setItem("liberal-life-partner-contact-draft", JSON.stringify(data));
  const subject = `ホームページからのお問い合わせ: ${data.service}`;
  const body = [
    "ホームページからお問い合わせがありました。",
    "",
    `お名前: ${data.name}`,
    `メールアドレス: ${data.email}`,
    `電話番号: ${data.phone || "未入力"}`,
    `ご相談したい事業: ${data.service}`,
    "",
    "お問い合わせ内容:",
    data.message,
  ].join("\n");

  const gmailUrl = new URL("https://mail.google.com/mail/");
  gmailUrl.searchParams.set("view", "cm");
  gmailUrl.searchParams.set("fs", "1");
  gmailUrl.searchParams.set("to", contactEmail);
  gmailUrl.searchParams.set("su", subject);
  gmailUrl.searchParams.set("body", body);

  window.open(gmailUrl.toString(), "_blank", "noopener");
  success.textContent = "Gmailのメール作成画面を開きました。内容をご確認のうえ送信してください。";
});
