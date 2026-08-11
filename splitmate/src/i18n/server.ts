import en from "./en.json";
import zh from "./zh.json";
import type { Locale } from "./context";

export function requestLocale(request: Request): Locale {
  return request.headers.get("x-ui-locale") === "en" ? "en" : "zh";
}

export function serverT(request: Request, key: string) {
  const locale = requestLocale(request);
  const dictionary = (locale === "en" ? en : zh) as Record<string, string>;
  return dictionary[key] ?? key;
}

const englishErrors: Record<string, string> = {
  "付款人不属于这个群组": "The payer is not a member of this group",
  "你不属于这个群组": "You are not a member of this group",
  "分摊方式无效": "Invalid split method",
  "单笔账单金额不能超过一百万元": "The expense amount exceeds the limit",
  "参与人不属于这个群组": "A participant is not a member of this group",
  "参与成员数据格式不正确": "Participant data is invalid",
  "只有群主可以修改群组设置": "Only the group owner can change group settings",
  "只有账单创建者可以删除": "Only the expense creator can delete it",
  "只有账单创建者可以编辑": "Only the expense creator can edit it",
  "名字需要 2 到 20 个字": "Name must be 2–20 characters",
  "密码至少需要 8 位": "Password must be at least 8 characters",
  "已经绑定邮箱": "An email has already been added",
  "成员数据格式不正确": "Member data is invalid",
  "本机信息已失效，请重置后重新开始": "Local profile is no longer valid. Reset the data to start again",
  "系统建议金额无效，请刷新后重试": "The suggested amount is no longer valid. Refresh and try again",
  "结算方案已经变化，请刷新后重试": "The settlement plan changed. Refresh and try again",
  "群组不存在": "Group not found",
  "群组成员数量无效": "Invalid group member count",
  "群组数据格式不正确": "Group data is invalid",
  "请先完成首次设置": "Complete the welcome setup first",
  "请填写群组名称": "Enter a group name",
  "请填写账单标题": "Enter an expense title",
  "请输入有效的邮箱": "Enter a valid email address",
  "请输入至少一个成员名字": "Enter at least one member name",
  "请输入要添加的成员名字": "Enter the names of members to add",
  "请选择参与成员": "Select at least one participant",
  "请选择支持的群组货币": "Choose a supported group currency",
  "账单不存在": "Expense not found",
  "账单分类无效": "Invalid expense category",
  "账单数据格式不正确": "Expense data is invalid",
  "账单日期无效": "Invalid expense date",
  "账单日期格式不正确": "Invalid expense date format",
  "账单金额必须大于零且精确到分": "Amount must be greater than zero and use the currency's smallest unit",
  "转账数据无效": "Invalid transfer data",
  "转账数据格式不正确": "Transfer data is invalid",
  "还款记录不存在": "Payment record not found",
  "还款金额不能超过系统建议金额": "Payment cannot exceed the suggested amount",
  "还款金额必须大于 0 且精确到分": "Payment must be greater than zero and use the currency's smallest unit",
  "这个邮箱已经注册过了，试试登录": "This email is already in use. Try logging in",
  "这个邮箱已经用于同步其他数据": "This email is already syncing other data",
  "邮箱或密码不对": "Email or password is incorrect",
  "默认演示数据不存在，请先重新 seed": "Demo data is missing. Seed the database again",
  "默认演示数据已经绑定邮箱，请登录": "The demo data is already synced. Log in to continue"
};

export function localizedError(request: Request, message: string, fallbackKey: string) {
  if (requestLocale(request) === "zh") return message;
  const exact = englishErrors[message];
  if (exact) return exact;
  if (/^每个群组最多支持 \d+ 位成员$/.test(message)) return "This group has reached its member limit";
  if (/^每个群组最多记录 \d+ 笔账单$/.test(message)) return "This group has reached its expense limit";
  if (/^(账单标题|AI 输入)不能超过 \d+ 个字符$/.test(message)) return "The input exceeds the allowed length";
  return serverT(request, fallbackKey);
}
