export const CTABanner = (props: {
  title: string;
  description: string;
  buttons: React.ReactNode;
}) => (
  <div className="
    rounded-xl bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 px-6
    py-10 text-center
  "
  >
    <div className="text-3xl font-bold text-white">
      {props.title}
    </div>

    <div className="mt-2 text-lg font-medium text-white/90">
      {props.description}
    </div>

    <div className="mt-6">{props.buttons}</div>
  </div>
);
