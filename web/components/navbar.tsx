"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
} from "@heroui/navbar";
import { Button } from "@heroui/button";
import { Kbd } from "@heroui/kbd";
import { Link } from "@heroui/link";
import { Input } from "@heroui/input";
import { link as linkStyles } from "@heroui/theme";
import NextLink from "next/link";
import clsx from "clsx";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import {
  TwitterIcon,
  GithubIcon,
  DiscordIcon,
  SearchIcon,
  Logo,
  ChatBubbleIcon,
} from "@/components/icons";
import {User} from "@heroui/user";
import {Popover, PopoverTrigger, PopoverContent} from "@heroui/popover";
import {Card, CardBody} from "@heroui/card";

export const Navbar = () => {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.username) setUsername(data.username);
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function iconFor(label: string) {
    if (label === "Messages") return <ChatBubbleIcon size={16} />;

    return null;
  }

  return (
    <HeroUINavbar
      classNames={{
        base: "bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800/60 shadow-lg shadow-black/40",
        wrapper: "px-4",
        item: [
          "text-zinc-300 hover:text-white transition-colors",
          "data-[active=true]:text-red-400 data-[active=true]:font-medium",
        ],
        brand: "text-zinc-100",
        toggleIcon: "text-zinc-300",
      }}
      isBlurred
      maxWidth="xl"
      position="sticky"
    >
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink
            className="flex justify-start items-center gap-2 text-zinc-100 hover:text-white transition-colors"
            href="/"
          >
            <span className="text-red-500">
              <Logo />
            </span>
            <p className="font-bold text-inherit tracking-tight">Yapp</p>
          </NextLink>
        </NavbarBrand>
        <ul className="hidden lg:flex gap-4 justify-start ml-2">
          {siteConfig.navItems.map((item) => {
            const icon = iconFor(item.label);

            return (
              <NavbarItem key={item.href}>
                <NextLink
                  className={clsx(
                    "inline-flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors",
                    "data-[active=true]:text-red-400 data-[active=true]:font-medium",
                  )}
                  href={item.href}
                >
                  {icon}
                  {item.label}
                </NextLink>
              </NavbarItem>
            );
          })}
        </ul>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2">
          <Link isExternal aria-label="Github" href={siteConfig.links.github}>
            <GithubIcon className="text-zinc-400 hover:text-white transition-colors" />
          </Link>
          <ThemeSwitch />
        </NavbarItem>
        {username && (
          <NavbarItem className="hidden sm:flex gap-2">
            <Popover placement="bottom-end">
              <PopoverTrigger>
                <button className="flex items-center gap-2">
                  <User avatarProps={{ className: 'w-5 h-5', src: '' }} description="" name={username} />
                </button>
              </PopoverTrigger>
              <PopoverContent>
                <Card className="border-none shadow-none">
                  <CardBody className="gap-2">
                    <div>
                      <p className="text-small text-default-500">Logged in for:</p>
                      <p className="text-small font-semibold">Value</p>
                    </div>
                    <div>
                      <p className="text-small text-default-500">Balance</p>
                      <p className="text-small font-semibold">$Value</p>
                    </div>
                  </CardBody>
                </Card>
              </PopoverContent>
            </Popover>
          </NavbarItem>
        )}
        <NavbarItem>
          <Button
            color="danger"
            size="sm"
            variant="flat"
            onPress={handleLogout}
          >
            Logout
          </Button>
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <Link isExternal aria-label="Github" href={siteConfig.links.github}>
          <GithubIcon className="text-default-500" />
        </Link>
        <ThemeSwitch />
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu>
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {siteConfig.navMenuItems.map((item, index) => (
            <NavbarMenuItem key={`${item}-${index}`}>
              <Link
                color={
                  index === 2
                    ? "primary"
                    : index === siteConfig.navMenuItems.length - 1
                      ? "danger"
                      : "foreground"
                }
                href="#"
                size="lg"
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
