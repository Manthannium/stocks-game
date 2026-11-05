import useAnimatedNumber from "../hooks/useAnimatedNumber";
import useFlashOnChange from "../hooks/useFlashOnChange";
import { money } from "../utils";

export default function AnimatedMoney({ value, className = "", flash = true }) {
  const display = useAnimatedNumber(value);
  const flashClass = useFlashOnChange(value);

  return (
    <span className={`${className} ${flash ? flashClass : ""}`.trim()}>
      {money(display)}
    </span>
  );
}