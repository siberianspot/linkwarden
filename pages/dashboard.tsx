import MainLayout from "@/layouts/MainLayout";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import React from "react";
import { toast } from "react-hot-toast";
import { MigrationFormat, MigrationRequest, ViewMode } from "@/types/global";
import DashboardItem from "@/components/DashboardItem";
import NewLinkModal from "@/components/ModalContent/NewLinkModal";
import PageHeader from "@/components/PageHeader";
import ViewDropdown from "@/components/ViewDropdown";
import { dropdownTriggerer } from "@/lib/client/utils";
import getServerSideProps from "@/lib/client/getServerSideProps";
import { useTranslation } from "next-i18next";
import { useCollections } from "@/hooks/store/collections";
import { useTags } from "@/hooks/store/tags";
import { useDashboardData } from "@/hooks/store/dashboardData";
import Links from "@/components/LinkViews/Links";
import useLocalSettingsStore from "@/store/localSettings";
import { useUpdateUser, useUser } from "@/hooks/store/user";
import SurveyModal from "@/components/ModalContent/SurveyModal";

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: collections = [] } = useCollections();
  const {
    data: { links = [], numberOfPinnedLinks } = { links: [] },
    ...dashboardData
  } = useDashboardData();
  const { data: tags = [] } = useTags();
  const { data: account = [] } = useUser();

  const [numberOfLinks, setNumberOfLinks] = useState(0);

  const { settings } = useLocalSettingsStore();

  useEffect(() => {
    setNumberOfLinks(
      collections.reduce(
        (accumulator, collection) =>
          accumulator + (collection._count as any).links,
        0
      )
    );
  }, [collections]);

  useEffect(() => {
    if (
      process.env.NEXT_PUBLIC_STRIPE === "true" &&
      account &&
      account.id &&
      account.referredBy === null &&
      // if user is using Linkwarden for more than 3 days
      new Date().getTime() - new Date(account.createdAt).getTime() >
      3 * 24 * 60 * 60 * 1000
    ) {
      setTimeout(() => {
        setShowsSurveyModal(true);
      }, 1000);
    }
  }, [account]);

  const numberOfLinksToShow = useMemo(() => {
    if (window.innerWidth > 1900) {
      return 10;
    } else if (window.innerWidth > 1500) {
      return 8;
    } else if (window.innerWidth > 880) {
      return 6;
    } else if (window.innerWidth > 550) {
      return 4;
    } else {
      return 2;
    }
  }, []);

  const importBookmarks = async (
    e: React.ChangeEvent<HTMLInputElement>,
    format: MigrationFormat
  ) => {
    const file: File | null = e.target.files && e.target.files[0];

    if (file) {
      const reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = async function (e) {
        const load = toast.loading("Importing...");

        const request: string = e.target?.result as string;

        const body: MigrationRequest = {
          format,
          data: request,
        };

        try {
          const response = await fetch("/api/v1/migration", {
            method: "POST",
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorData = await response.json();
            toast.dismiss(load);

            toast.error(
              errorData.response ||
              "Failed to import bookmarks. Please try again."
            );
            return;
          }

          await response.json();
          toast.dismiss(load);
          toast.success("Imported the Bookmarks! Reloading the page...");

          setTimeout(() => {
            location.reload();
          }, 2000);
        } catch (error) {
          console.error("Request failed", error);
          toast.dismiss(load);
          toast.error(
            "An error occurred while importing bookmarks. Please check the logs for more info."
          );
        }
      };

      reader.onerror = function (e) {
        console.log("Error reading file:", e);
        toast.error(
          "Failed to read the file. Please make sure the file is correct and try again."
        );
      };
    }
  };

  const [newLinkModal, setNewLinkModal] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>(
    (localStorage.getItem("viewMode") as ViewMode) || ViewMode.Card
  );

  const [showSurveyModal, setShowsSurveyModal] = useState(false);

  const { data: user } = useUser();
  const updateUser = useUpdateUser();

  const [submitLoader, setSubmitLoader] = useState(false);

  const submitSurvey = async (referer: string, other?: string) => {
    if (submitLoader) return;

    setSubmitLoader(true);

    const load = toast.loading(t("applying"));

    await updateUser.mutateAsync(
      {
        ...user,
        referredBy: referer === "other" ? "Other: " + other : referer,
      },
      {
        onSettled: (data, error) => {
          console.log(data, error);
          setSubmitLoader(false);
          toast.dismiss(load);

          if (error) {
            toast.error(error.message);
          } else {
            toast.success(t("thanks_for_feedback"));
            setShowsSurveyModal(false);
          }
        },
      }
    );
  };

  return (
    <MainLayout>
      <div style={{ flex: "1 1 auto" }} className="p-5 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <PageHeader
            icon={"bi-house "}
            title={"Dashboard"}
            description={t("dashboard_desc")}
          />
          <ViewDropdown viewMode={viewMode} setViewMode={setViewMode} />
        </div>

        <div className="xl:flex flex flex-col sm:grid grid-cols-2 gap-3 xl:flex-row xl:justify-evenly xl:w-full h-full">
          <DashboardItem
            name={numberOfLinks === 1 ? t("link") : t("links")}
            value={numberOfLinks}
            icon={"bi-link-45deg"}
          />

          <DashboardItem
            name={collections.length === 1 ? t("collection") : t("collections")}
            value={collections.length}
            icon={"bi-folder"}
          />

          <DashboardItem
            name={tags.length === 1 ? t("tag") : t("tags")}
            value={tags.length}
            icon={"bi-hash"}
          />

          <DashboardItem
            name={t("pinned")}
            value={numberOfPinnedLinks}
            icon={"bi-pin-angle"}
          />
        </div>

        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center">
            <PageHeader
              icon={"bi-clock-history"}
              title={t("recent")}
              description={t("recent_links_desc")}
            />
          </div>
          <Link
            href="/links"
            className="flex items-center text-sm text-black/75 dark:text-white/75 gap-2 cursor-pointer"
          >
            {t("view_all")}
            <i className="bi-chevron-right text-sm"></i>
          </Link>
        </div>

        <div
          style={{
            flex: links || dashboardData.isLoading ? "0 1 auto" : "1 1 auto",
          }}
          className="flex flex-col 2xl:flex-row items-start 2xl:gap-2"
        >
          {dashboardData.isLoading ? (
            <div className="w-full">
              <Links
                layout={viewMode}
                placeholderCount={settings.columns || 1}
                useData={dashboardData}
              />
            </div>
          ) : links && links[0] && !dashboardData.isLoading ? (
            <div className="w-full">
              <Links
                links={links.slice(
                  0,
                  settings.columns ? settings.columns * 2 : numberOfLinksToShow
                )}
                layout={viewMode}
              />
            </div>
          ) : (
            <div className="flex flex-col justify-center h-full border border-solid border-neutral-content w-full mx-auto p-10 rounded-2xl bg-base-200 bg-gradient-to-tr from-neutral-content/70 to-50% to-base-200">
              <p className="text-center text-2xl">
                {t("view_added_links_here")}
              </p>
              <p className="text-center mx-auto max-w-96 w-fit text-neutral text-sm mt-2">
                {t("view_added_links_here_desc")}
              </p>

              <div className="text-center w-full mt-4 flex flex-wrap gap-4 justify-center">
                <div
                  onClick={() => {
                    setNewLinkModal(true);
                  }}
                  className="inline-flex items-center gap-2 text-sm btn btn-accent dark:border-violet-400 text-white"
                >
                  <i className="bi-plus-lg text-xl"></i>
                  <span className="group-hover:opacity-0 text-right">
                    {t("add_link")}
                  </span>
                </div>

                <div className="dropdown dropdown-bottom">
                  <div
                    tabIndex={0}
                    role="button"
                    onMouseDown={dropdownTriggerer}
                    className="inline-flex items-center gap-2 text-sm btn bg-neutral-content text-secondary-foreground hover:bg-neutral-content/80 border border-neutral/30 hover:border hover:border-neutral/30"
                    id="import-dropdown"
                  >
                    <i className="bi-cloud-upload text-xl duration-100"></i>
                    <p>{t("import_links")}</p>
                  </div>
                  <ul className="shadow menu dropdown-content z-[1] bg-base-200 border border-neutral-content rounded-box mt-1">
                    <li>
                      <label
                        tabIndex={0}
                        role="button"
                        htmlFor="import-linkwarden-file"
                        title={t("from_linkwarden")}
                        className="whitespace-nowrap"
                      >
                        {t("from_linkwarden")}
                        <input
                          type="file"
                          name="photo"
                          id="import-linkwarden-file"
                          accept=".json"
                          className="hidden"
                          onChange={(e) =>
                            importBookmarks(e, MigrationFormat.linkwarden)
                          }
                        />
                      </label>
                    </li>
                    <li>
                      <label
                        tabIndex={0}
                        role="button"
                        htmlFor="import-html-file"
                        title={t("from_html")}
                        className="whitespace-nowrap"
                      >
                        {t("from_html")}
                        <input
                          type="file"
                          name="photo"
                          id="import-html-file"
                          accept=".html"
                          className="hidden"
                          onChange={(e) =>
                            importBookmarks(e, MigrationFormat.htmlFile)
                          }
                        />
                      </label>
                    </li>
                    <li>
                      <label
                        tabIndex={0}
                        role="button"
                        htmlFor="import-wallabag-file"
                        title={t("from_wallabag")}
                        className="whitespace-nowrap"
                      >
                        {t("from_wallabag")}
                        <input
                          type="file"
                          name="photo"
                          id="import-wallabag-file"
                          accept=".json"
                          className="hidden"
                          onChange={(e) =>
                            importBookmarks(e, MigrationFormat.wallabag)
                          }
                        />
                      </label>
                    </li>
                    <li>
                      <label
                        tabIndex={0}
                        role="button"
                        htmlFor="import-omnivore-file"
                        title={t("from_omnivore")}
                        className="whitespace-nowrap"
                      >
                        {t("from_omnivore")}
                        <input
                          type="file"
                          name="photo"
                          id="import-omnivore-file"
                          accept=".zip"
                          className="hidden"
                          onChange={(e) =>
                            importBookmarks(e, MigrationFormat.omnivore)
                          }
                        />
                      </label>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center">
            <PageHeader
              icon={"bi-pin-angle"}
              title={t("pinned")}
              description={t("pinned_links_desc")}
            />
          </div>
          <Link
            href="/links/pinned"
            className="flex items-center text-sm text-black/75 dark:text-white/75 gap-2 cursor-pointer"
          >
            {t("view_all")}
            <i className="bi-chevron-right text-sm "></i>
          </Link>
        </div>

        <div
          style={{ flex: "1 1 auto" }}
          className="flex flex-col 2xl:flex-row items-start 2xl:gap-2"
        >
          {dashboardData.isLoading ? (
            <div className="w-full">
              <Links
                layout={viewMode}
                placeholderCount={settings.columns || 1}
                useData={dashboardData}
              />
            </div>
          ) : links?.some((e: any) => e.pinnedBy && e.pinnedBy[0]) ? (
            <div className="w-full">
              <Links
                links={links
                  .filter((e: any) => e.pinnedBy && e.pinnedBy[0])
                  .slice(
                    0,
                    settings.columns
                      ? settings.columns * 2
                      : numberOfLinksToShow
                  )}
                layout={viewMode}
              />
            </div>
          ) : (
            <div
              style={{ flex: "1 1 auto" }}
              className="flex flex-col gap-2 justify-center h-full border border-solid border-neutral-content w-full mx-auto p-10 rounded-2xl bg-base-200 bg-gradient-to-tr from-neutral-content/70 to-50% to-base-200"
            >
              <i className="bi-pin mx-auto text-6xl text-primary"></i>
              <p className="text-center text-2xl">
                {t("pin_favorite_links_here")}
              </p>
              <p className="text-center mx-auto max-w-96 w-fit text-neutral text-sm">
                {t("pin_favorite_links_here_desc")}
              </p>
            </div>
          )}
        </div>
      </div>
      {showSurveyModal && (
        <SurveyModal
          submit={submitSurvey}
          onClose={() => {
            setShowsSurveyModal(false);
          }}
        />
      )}
      {newLinkModal && <NewLinkModal onClose={() => setNewLinkModal(false)} />}
    </MainLayout>
  );
}

export { getServerSideProps };
