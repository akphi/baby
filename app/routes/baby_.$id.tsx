import { AppBar, Box, Toolbar, Typography } from "@mui/material";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { BabyCareDataRegistry, BabyCareProfile } from "../data/baby-care";
import { guaranteeNonNullable } from "../shared/AssertionUtils";
import { useLoaderData } from "@remix-run/react";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const id = guaranteeNonNullable(params.id);
  console.log(id);
  const entityManager = await BabyCareDataRegistry.getEntityManager();
  const profile = await entityManager.findOneOrFail(BabyCareProfile, {
    $or: [{ id }, { shortId: id }],
  });
  return json({ profile });
};

export default function BabyCare() {
  const { profile } = useLoaderData<typeof loader>();
  console.log("alo", profile);

  // console.log(profiles);

  return (
    <div className="flex">
      <AppBar component="nav">
        <Toolbar>
          {/* <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            {/* <MenuIcon /> */}
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, display: { xs: "none", sm: "block" } }}
          >
            Chopchop
          </Typography>
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            {/* <Button key={item} sx={{ color: "#fff" }}>
                {item}
              </Button> */}
            {/* {navItems.map((item) => (
            ))} */}
          </Box>
        </Toolbar>
      </AppBar>
      <main className="">
        {/* empty toolbar to offset the content the height of the real toolbar */}
        <Toolbar />
        <Typography>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Similique
          unde fugit veniam eius, perspiciatis sunt? Corporis qui ducimus
          quibusdam, aliquam dolore excepturi quae. Distinctio enim at eligendi
          perferendis in cum quibusdam sed quae, accusantium et aperiam? Quod
          itaque exercitationem, at ab sequi qui modi delectus quia corrupti
          alias distinctio nostrum. Minima ex dolor modi inventore sapiente
          necessitatibus aliquam fuga et. Sed numquam quibusdam at officia
          sapiente porro maxime corrupti perspiciatis asperiores, exercitationem
          eius nostrum consequuntur iure aliquam itaque, assumenda et! Quibusdam
          temporibus beatae doloremque voluptatum doloribus soluta accusamus
          porro reprehenderit eos inventore facere, fugit, molestiae ab officiis
          illo voluptates recusandae. Vel dolor nobis eius, ratione atque
          soluta, aliquam fugit qui iste architecto perspiciatis. Nobis,
          voluptatem! Cumque, eligendi unde aliquid minus quis sit debitis
          obcaecati error, delectus quo eius exercitationem tempore. Delectus
          sapiente, provident corporis dolorum quibusdam aut beatae repellendus
          est labore quisquam praesentium repudiandae non vel laboriosam quo ab
          perferendis velit ipsa deleniti modi! Ipsam, illo quod. Nesciunt
          commodi nihil corrupti cum non fugiat praesentium doloremque
          architecto laborum aliquid. Quae, maxime recusandae? Eveniet dolore
          molestiae dicta blanditiis est expedita eius debitis cupiditate porro
          sed aspernatur quidem, repellat nihil quasi praesentium quia eos,
          quibusdam provident. Incidunt tempore vel placeat voluptate iure
          labore, repellendus beatae quia unde est aliquid dolor molestias
          libero. Reiciendis similique exercitationem consequatur, nobis placeat
          illo laudantium! Enim perferendis nulla soluta magni error, provident
          repellat similique cupiditate ipsam, et tempore cumque quod! Qui, iure
          suscipit tempora unde rerum autem saepe nisi vel cupiditate iusto.
          Illum, corrupti? Fugiat quidem accusantium nulla. Aliquid inventore
          commodi reprehenderit rerum reiciendis! Quidem alias repudiandae eaque
          eveniet cumque nihil aliquam in expedita, impedit quas ipsum nesciunt
          ipsa ullam consequuntur dignissimos numquam at nisi porro a, quaerat
          rem repellendus. Voluptates perspiciatis, in pariatur impedit, nam
          facilis libero dolorem dolores sunt inventore perferendis, aut
          sapiente modi nesciunt.
        </Typography>
      </main>
    </div>
  );

  // <>
  //   <form method="post">
  //     <input name="name" />
  //     <input name="type" type="hidden" value={FormType.UpdateName} />
  //     <button type="submit">Save</button>
  //   </form>

  //   <form method="post">
  //     <input name="avatar" />
  //     <input name="type" type="hidden" value={FormType.UpdateAvatar} />
  //     <button type="submit">Save</button>
  //   </form>
  // </>
}
